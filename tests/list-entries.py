import zipfile, json, glob, os, sys
here = os.path.dirname(os.path.abspath(__file__))
out = {}
for f in sorted(glob.glob(os.path.join(here, 'fixtures', '*.zip'))):
    try:
        z = zipfile.ZipFile(f)
        out[os.path.basename(f)] = [{'p': i.filename, 'dir': i.is_dir(), 'size': i.file_size, 'perm': (i.external_attr >> 16) & 0o777} for i in z.infolist()]
    except Exception:
        out[os.path.basename(f)] = 'ERR'
json.dump(out, sys.stdout, ensure_ascii=False)
