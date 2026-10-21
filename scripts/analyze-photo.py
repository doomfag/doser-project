"""Read-only raster inspection and duplicate features; never emits a modified photo."""
import sys, json, hashlib
from PIL import Image, ImageStat
Image.MAX_IMAGE_PIXELS = 24_000_000
with Image.open(sys.argv[1]) as image:
    fmt = image.format
    if fmt not in ('JPEG', 'PNG', 'WEBP'):
        raise ValueError('Unsupported raster format')
    if min(image.size) < 80 or image.width * image.height > 24_000_000:
        raise ValueError('Dimensions outside bounds')
    image.load()
    rgba=image.convert('RGBA')
    rgb=Image.new('RGB',image.size,'white');rgb.paste(rgba,mask=rgba.getchannel('A'))
    pixels=rgb.resize((64,64),Image.Resampling.LANCZOS)
    non_white=sum(min(p)<240 for p in pixels.getdata())/4096
    if non_white < .015:
        raise ValueError('Empty or near-empty image')
    gray=rgb.convert('L')
    dh=list(gray.resize((9,8),Image.Resampling.LANCZOS).getdata())
    differences=[dh[y*9+x]>dh[y*9+x+1] for y in range(8) for x in range(8)]
    small=list(gray.resize((8,8),Image.Resampling.LANCZOS).getdata())
    average=sum(small)/64
    def bits(values):
        return format(sum(int(v)<<i for i,v in enumerate(values)), '016x')
    print(json.dumps(dict(contentType={'JPEG':'image/jpeg','PNG':'image/png','WEBP':'image/webp'}[fmt],
        width=image.width,height=image.height,
        pixelHash=hashlib.sha256(pixels.tobytes()).hexdigest(),
        dHash=bits(differences),aHash=bits(v>average for v in small),
        mean=ImageStat.Stat(pixels).mean,nonWhiteRatio=non_white)))
