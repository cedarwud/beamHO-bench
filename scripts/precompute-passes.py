#!/usr/bin/env python3
"""
Pre-compute satellite pass trajectories for beamHO-bench visualization.
Uses Skyfield SGP4 to generate dense az/el time series for each visible pass.

Output: JSON file with per-satellite pass data at 1-second resolution,
covering a configurable simulation window.
"""

import json
import sys
import time
from pathlib import Path
from datetime import datetime, timezone, timedelta

from skyfield.api import load, EarthSatellite, wgs84
from skyfield.timelib import Time
import numpy as np


# NTPU ground station - SOURCE: beamHO-bench/src/config/ntpu.config.ts
OBSERVER_LAT = 24.9441667
OBSERVER_LON = 121.3713889
OBSERVER_ALT_M = 50.0

# Simulation window
WINDOW_DURATION_MIN = 120  # 2 hours of passes
TIME_STEP_SEC = 1  # 1-second resolution for smooth rendering

# Constellation configs matching beamHO-bench profiles
CONSTELLATIONS = {
    'starlink': {
        'tle_dir': '../tle_data/starlink/tle',
        'min_elevation_deg': 10.0,
        'max_satellites': 200,  # limit for performance
    },
    'oneweb': {
        'tle_dir': '../tle_data/oneweb/tle',
        'min_elevation_deg': 10.0,
        'max_satellites': 200,
    },
}


def load_tle_satellites(tle_dir: str, max_sats: int) -> list:
    """Load satellites from the latest TLE file in directory."""
    tle_path = Path(tle_dir)
    tle_files = sorted(tle_path.glob('*.tle'))
    if not tle_files:
        print(f"No TLE files found in {tle_dir}")
        return []

    latest = tle_files[-1]
    print(f"Loading TLE: {latest.name}")

    ts = load.timescale()
    satellites = []
    lines = latest.read_text().strip().split('\n')

    i = 0
    while i < len(lines) - 2:
        name = lines[i].strip()
        line1 = lines[i + 1].strip()
        line2 = lines[i + 2].strip()
        if line1.startswith('1 ') and line2.startswith('2 '):
            try:
                sat = EarthSatellite(line1, line2, name, ts)
                norad_id = int(line1[2:7])
                satellites.append((norad_id, name, sat))
            except Exception:
                pass
            i += 3
        else:
            i += 1

    # Limit satellite count
    if len(satellites) > max_sats:
        satellites = satellites[:max_sats]

    print(f"  Loaded {len(satellites)} satellites")
    return satellites


def find_passes(satellites: list, min_elev: float, window_min: int) -> dict:
    """
    Compute az/el time series for all satellites over the simulation window.
    Returns dict of satellite passes with dense trajectory data.
    """
    ts = load.timescale()
    observer = wgs84.latlon(OBSERVER_LAT, OBSERVER_LON, OBSERVER_ALT_M)

    # Use current time as start
    now = datetime.now(timezone.utc)
    t_start = ts.from_datetime(now)
    t_end = ts.from_datetime(now + timedelta(minutes=window_min))

    # Generate time array at 1-second resolution
    n_steps = window_min * 60
    t_array = ts.linspace(t_start, t_end, n_steps + 1)

    print(f"Computing {n_steps} time steps for {len(satellites)} satellites...")
    start_time = time.time()

    all_passes = {}
    visible_count = 0

    for idx, (norad_id, name, sat) in enumerate(satellites):
        if idx % 50 == 0:
            print(f"  Processing satellite {idx}/{len(satellites)}...")

        try:
            # Compute topocentric position for all time steps at once (vectorized)
            diff = sat - observer
            topocentric = diff.at(t_array)
            alt_deg, az_deg, distance = topocentric.altaz()

            elevations = alt_deg.degrees
            azimuths = az_deg.degrees
            ranges_km = distance.km

            # Find segments where satellite is above min elevation
            above = elevations >= min_elev

            if not np.any(above):
                continue

            # Extract individual passes (contiguous segments above horizon)
            passes = []
            in_pass = False
            pass_start = 0

            # Include pre/post horizon data for smooth entry/exit
            # Extend by 60 seconds on each side
            extend_steps = 60

            for i in range(len(above)):
                if above[i] and not in_pass:
                    in_pass = True
                    pass_start = max(0, i - extend_steps)
                elif not above[i] and in_pass:
                    in_pass = False
                    pass_end = min(len(above) - 1, i + extend_steps)
                    passes.append((pass_start, pass_end))

            if in_pass:
                passes.append((pass_start, min(len(above) - 1, len(above) - 1)))

            if not passes:
                continue

            visible_count += 1

            sat_passes = []
            for p_start, p_end in passes:
                # Sample at TIME_STEP_SEC intervals
                trajectory = []
                for i in range(p_start, p_end + 1):
                    t_offset_sec = i  # each step is 1 second
                    trajectory.append({
                        't': t_offset_sec,
                        'az': round(float(azimuths[i]), 3),
                        'el': round(float(elevations[i]), 3),
                        'r': round(float(ranges_km[i]), 1),
                    })

                if trajectory:
                    sat_passes.append({
                        'startSec': trajectory[0]['t'],
                        'endSec': trajectory[-1]['t'],
                        'maxElDeg': round(float(np.max(elevations[p_start:p_end + 1])), 2),
                        'trajectory': trajectory,
                    })

            if sat_passes:
                all_passes[str(norad_id)] = {
                    'noradId': norad_id,
                    'name': name.strip(),
                    'passes': sat_passes,
                }

        except Exception as e:
            # Skip satellites with propagation errors
            continue

    elapsed = time.time() - start_time
    print(f"Done in {elapsed:.1f}s. {visible_count} satellites with visible passes.")
    return all_passes


def main():
    constellation = sys.argv[1] if len(sys.argv) > 1 else 'starlink'
    config = CONSTELLATIONS.get(constellation)
    if not config:
        print(f"Unknown constellation: {constellation}")
        sys.exit(1)

    print(f"=== Pre-computing passes for {constellation} ===")

    # Resolve TLE path relative to this script's location
    script_dir = Path(__file__).parent.parent
    tle_dir = (script_dir / config['tle_dir']).resolve()

    satellites = load_tle_satellites(str(tle_dir), config['max_satellites'])
    if not satellites:
        sys.exit(1)

    passes = find_passes(
        satellites,
        config['min_elevation_deg'],
        WINDOW_DURATION_MIN,
    )

    # Output
    output = {
        'constellation': constellation,
        'observer': {
            'lat': OBSERVER_LAT,
            'lon': OBSERVER_LON,
            'altM': OBSERVER_ALT_M,
        },
        'windowDurationMin': WINDOW_DURATION_MIN,
        'timeStepSec': TIME_STEP_SEC,
        'minElevationDeg': config['min_elevation_deg'],
        'generatedAtUtc': datetime.now(timezone.utc).isoformat(),
        'satelliteCount': len(passes),
        'passes': passes,
    }

    out_dir = script_dir / 'public' / 'trajectory-data'
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f'{constellation}-passes.json'

    with open(out_path, 'w') as f:
        json.dump(output, f, separators=(',', ':'))

    size_mb = out_path.stat().st_size / (1024 * 1024)
    print(f"Output: {out_path} ({size_mb:.1f} MB)")
    print(f"Satellites with passes: {len(passes)}")


if __name__ == '__main__':
    main()
