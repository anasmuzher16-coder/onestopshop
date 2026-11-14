# One-off edit (kept as history): wires the admin API, uploaded photos and the admin page into the Worker.
# Run from store/:  python tools/step-admin-wire.py
def edit(path, pairs):
    s = open(path, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (path, a[:60], s.count(a))
        s = s.replace(a, b)
    open(path, 'w', encoding='utf8', newline='\n').write(s)

edit('src/worker.js', [
    ('import { loadCatalog, catalogModule } from "./catalog.js";', 'import { loadCatalog, catalogModule } from "./catalog.js";\nimport { admin, photo } from "./admin.js";'),
    ('      if (path.startsWith("/api/")) return json({ error: "Not found" }, 404);',
     '      if (path.startsWith("/api/admin/")) return await admin(request, env, url);\n'
     '      const ph = path.match(/^\\/api\\/photo\\/(OSS-\\d{4,6})$/); if (ph && request.method === "GET") return await photo(env, ph[1]);\n'
     '      if (path.startsWith("/api/")) return json({ error: "Not found" }, 404);'),
    ('      if (path === "/admin" || path.startsWith("/admin/")) return new Response("Not built yet", { status: 404, headers: { "X-Robots-Tag": "noindex" } });',
     '      if (path === "/admin" || path.startsWith("/admin/")) {\n'
     '        if (path !== "/admin") return Response.redirect(url.origin + "/admin", 302);\n'
     '        const shell = await env.ASSETS.fetch(new URL("/admin.html", url)), headers = new Headers(shell.headers);\n'
     '        for (const [k, v] of Object.entries(SECURITY)) headers.set(k, v);\n'
     '        headers.set("Content-Security-Policy", SECURITY["Content-Security-Policy"].replace("img-src \'self\' data:", "img-src \'self\' data: blob:"));\n'
     '        headers.set("X-Robots-Tag", "noindex, nofollow"); headers.set("Cache-Control", "no-cache");\n'
     '        return new Response(shell.body, { status: 200, headers });\n'
     '      }'),
])
edit('src/catalog.js', [
    ('p.img, p.img_dark, p.img_lw, p.details, p.stock FROM', 'p.img, p.img_dark, p.img_lw, p.photo_ver, p.details, p.stock FROM'),
    ('height: p.height_cm, note: p.note, img: p.img, dark: !!p.img_dark, lw: p.img_lw ?? undefined,',
     'height: p.height_cm, note: p.note, ...(p.photo_ver ? { img: `/api/photo/${p.sku}?v=${p.photo_ver}`, photo: true, dark: false } : { img: p.img, dark: !!p.img_dark, lw: p.img_lw ?? undefined }),'),
])
edit('public/app.js', [
    ('const imgSrc = (p, small) => p.photo ? `img/${p.img}.webp` :', 'const imgSrc = (p, small) => p.photo ? (p.img[0] === "/" ? p.img : `img/${p.img}.webp`) :'),
])
print('wired')
