from pathlib import Path
root=Path(__file__).resolve().parent
s=(root/'src/shell.html').read_text(encoding='utf-8')
for marker,path in [('CSS','style.css'),('ENGINE','engine.js'),('DATA','data.js'),('CATALOG','catalog.js'),('AUTO','auto-engine.js'),('AUTOUI','auto-ui.js'),('APP','app.js')]:
    text=(root/'src'/path).read_text(encoding='utf-8')
    if marker != 'CSS': text=text.replace('</script','<\\/script')
    s=s.replace('/* INLINE_'+marker+' */',text)
(root/'index.html').write_text(s,encoding='utf-8')
print(f'Built {root/"index.html"} ({len(s.encode()):,} bytes)')
