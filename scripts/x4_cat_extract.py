#!/usr/bin/env python3
"""
X4 Foundations .cat/.dat extractor.

X4's archive format:
  - .cat file: plain text, one line per entry: "filepath size timestamp hash"
  - .dat file: binary blob, files concatenated in the same order as the .cat
  
Usage:
    python x4_cat_extract.py <cat_file> <output_dir> [--filter <prefix>]

Examples:
    # Extract all UI files from 08.cat
    python x4_cat_extract.py "G:/.../08.cat" "<DEV_ENV>/x4-unpacked" --filter "ui/"
    
    # Extract everything from a cat file  
    python x4_cat_extract.py "G:/.../08.cat" "<DEV_ENV>/x4-unpacked"
"""

import os
import sys
import argparse
from pathlib import Path


def parse_cat(cat_path: str) -> list[dict]:
    """Parse a .cat index file into a list of entry dicts."""
    entries = []
    with open(cat_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            
            # Format: "filepath size timestamp hash"
            # Filepath can contain spaces in theory, but X4 vanilla doesn't use them.
            # We split from the right to handle edge cases.
            parts = line.rsplit(" ", 3)
            if len(parts) != 4:
                print(f"  WARNING: Skipping malformed line {line_num}: {line[:80]}...")
                continue
            
            filepath, size_str, timestamp_str, hash_str = parts
            
            try:
                size = int(size_str)
            except ValueError:
                # Some entries have filenames with spaces - try alternate parsing
                # Split from right: hash(32hex) timestamp(digits) size(digits) rest=filepath
                tokens = line.split(" ")
                hash_str = tokens[-1]
                timestamp_str = tokens[-2]
                size_str = tokens[-3]
                filepath = " ".join(tokens[:-3])
                try:
                    size = int(size_str)
                except ValueError:
                    print(f"  WARNING: Cannot parse size on line {line_num}: {line[:80]}...")
                    continue
            
            entries.append({
                "path": filepath,
                "size": size,
                "timestamp": timestamp_str,
                "hash": hash_str,
            })
    
    return entries


def extract_from_dat(dat_path: str, entries: list[dict], output_dir: str, 
                      filter_prefix: str = None) -> int:
    """Extract files from the .dat blob using the parsed .cat index."""
    extracted = 0
    skipped = 0
    
    with open(dat_path, "rb") as dat:
        offset = 0
        for entry in entries:
            if filter_prefix and not entry["path"].startswith(filter_prefix):
                # Skip this entry but still advance the offset
                offset += entry["size"]
                dat.seek(offset)
                skipped += 1
                continue
            
            # Read the file data
            dat.seek(offset)
            data = dat.read(entry["size"])
            
            if len(data) != entry["size"]:
                print(f"  ERROR: Expected {entry['size']} bytes for {entry['path']}, "
                      f"got {len(data)}. Archive may be corrupted.")
                offset += entry["size"]
                continue
            
            # Write to output
            out_path = Path(output_dir) / entry["path"]
            out_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(out_path, "wb") as out:
                out.write(data)
            
            extracted += 1
            offset += entry["size"]
    
    return extracted, skipped


def main():
    parser = argparse.ArgumentParser(description="Extract files from X4 .cat/.dat archives")
    parser.add_argument("cat_file", help="Path to the .cat index file")
    parser.add_argument("output_dir", help="Directory to extract files into")
    parser.add_argument("--filter", default=None, 
                        help="Only extract files whose path starts with this prefix (e.g. 'ui/')")
    parser.add_argument("--list", action="store_true",
                        help="List contents without extracting")
    parser.add_argument("--dry-run", action="store_true",
                        help="Parse and show what would be extracted, without writing")
    args = parser.parse_args()
    
    cat_path = args.cat_file
    dat_path = cat_path.replace(".cat", ".dat")
    
    if not os.path.isfile(cat_path):
        print(f"ERROR: Cat file not found: {cat_path}")
        sys.exit(1)
    
    if not args.list and not os.path.isfile(dat_path):
        print(f"ERROR: Dat file not found: {dat_path}")
        print(f"  Expected at: {dat_path}")
        sys.exit(1)
    
    print(f"Parsing: {cat_path}")
    entries = parse_cat(cat_path)
    print(f"  Found {len(entries)} entries in catalog")
    
    # Apply filter
    if args.filter:
        matching = [e for e in entries if e["path"].startswith(args.filter)]
        print(f"  Filter '{args.filter}': {len(matching)} matching entries")
    else:
        matching = entries
    
    if args.list:
        for e in matching:
            print(f"  {e['size']:>10}  {e['path']}")
        print(f"\n  Total: {len(matching)} files, "
              f"{sum(e['size'] for e in matching) / 1024 / 1024:.1f} MB")
        return
    
    if args.dry_run:
        total_size = sum(e["size"] for e in matching)
        print(f"\n  Would extract {len(matching)} files ({total_size / 1024 / 1024:.1f} MB)")
        print(f"  To: {args.output_dir}")
        for e in matching[:20]:
            print(f"    {e['path']}")
        if len(matching) > 20:
            print(f"    ... and {len(matching) - 20} more")
        return
    
    print(f"Extracting to: {args.output_dir}")
    extracted, skipped = extract_from_dat(dat_path, entries, args.output_dir, args.filter)
    print(f"  Extracted: {extracted} files")
    if skipped:
        print(f"  Skipped (filtered): {skipped}")
    print("Done.")


if __name__ == "__main__":
    main()
