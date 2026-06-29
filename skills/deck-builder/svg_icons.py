"""
svg_icons — give python-pptx pictures a TRUE vector SVG body (with the PNG as
fallback), the way PowerPoint itself stores SVGs (asvg:svgBlip extension).

Workflow:
  1. Build with pptx_kit.icon(slide, "icons/foo.png", cx, cy, size, key="foo")
     -> the picture is named "svgicon_foo" and embeds foo.png.
  2. prs.save(path)   (python-pptx drops the svg content-type, that's fine)
  3. embed_svgs(path, svg_dir="icons")  -> attaches icons/foo.svg as the vector
     body of every svgicon_foo picture and restores the svg content-type.

Idempotent: pictures whose blip already has the extension are skipped, so you
can rebuild a single slide and re-run embed_svgs without double-injecting.

Generalised from a technique proven across production decks.
"""
import zipfile, re, shutil, os

EXT_URI = "{96DAC541-7B7A-43D3-8B79-37D633B846F1}"
_ASVG = "http://schemas.microsoft.com/office/drawing/2016/SVG/main"

def _ensure_svg_ct(parts):
    ct = parts['[Content_Types].xml'].decode()
    if 'Extension="svg"' not in ct:
        ct = ct.replace('<Default Extension="png" ContentType="image/png"/>',
                        '<Default Extension="png" ContentType="image/png"/>'
                        '<Default Extension="svg" ContentType="image/svg+xml"/>')
        parts['[Content_Types].xml'] = ct.encode()

def embed_svgs(pptx_path, svg_dir, start_index=1400):
    """Attach <svg_dir>/<key>.svg to every picture named svgicon_<key>."""
    z = zipfile.ZipFile(pptx_path)
    parts = {n: z.read(n) for n in z.namelist()}; z.close()
    _ensure_svg_ct(parts)
    counter, total = start_index, 0
    for name in [n for n in list(parts) if re.match(r'ppt/slides/slide\d+\.xml$', n)]:
        xml = parts[name].decode()
        if 'svgicon_' not in xml:
            continue
        rels_name = f'ppt/slides/_rels/{os.path.basename(name)}.rels'
        rels = parts[rels_name].decode()
        maxn = max([int(x) for x in re.findall(r'Id="rId(\d+)"', rels)] or [0])
        for blk in re.findall(r'<p:pic>.*?</p:pic>', xml, re.S):
            if 'svgicon_' not in blk:
                continue
            mkey = re.search(r'name="svgicon_(\w+)"', blk)
            mblip = re.search(r'<a:blip r:embed="(rId\d+)"\s*/>', blk)  # self-closing => not yet injected
            if not (mkey and mblip):
                continue
            svg_src = os.path.join(svg_dir, mkey.group(1) + ".svg")
            if not os.path.exists(svg_src):
                continue
            svgfile = f'image{counter}.svg'; counter += 1
            parts['ppt/media/' + svgfile] = open(svg_src, 'rb').read()
            maxn += 1; rid = f'rId{maxn}'
            rels = rels.replace('</Relationships>',
                f'<Relationship Id="{rid}" Type="http://schemas.openxmlformats.org/'
                f'officeDocument/2006/relationships/image" Target="../media/{svgfile}"/></Relationships>')
            new_blip = (f'<a:blip r:embed="{mblip.group(1)}"><a:extLst><a:ext uri="{EXT_URI}">'
                        f'<asvg:svgBlip xmlns:asvg="{_ASVG}" r:embed="{rid}"/></a:ext></a:extLst></a:blip>')
            xml = xml.replace(blk, blk.replace(mblip.group(0), new_blip)); total += 1
        parts[name] = xml.encode(); parts[rels_name] = rels.encode()
    tmp = pptx_path + ".tmp"
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as out:
        for n, b in parts.items():
            out.writestr(n, b)
    shutil.move(tmp, pptx_path)
    return total

def fix_svg_content_type(pptx_path):
    """If a python-pptx save dropped the svg Default, restore it (prevents the
    'no content-type for image*.svg' open error)."""
    z = zipfile.ZipFile(pptx_path); parts = {n: z.read(n) for n in z.namelist()}; z.close()
    before = parts['[Content_Types].xml']
    _ensure_svg_ct(parts)
    if parts['[Content_Types].xml'] == before:
        return False
    tmp = pptx_path + ".tmp"
    with zipfile.ZipFile(tmp, 'w', zipfile.ZIP_DEFLATED) as out:
        for n, b in parts.items():
            out.writestr(n, b)
    shutil.move(tmp, pptx_path)
    return True
