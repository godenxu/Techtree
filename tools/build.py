#!/usr/bin/env python3
"""
金融科技树 · 单文件打包
--------------------------------------------------------------------
把 techtree.html 引用的所有 CSS / JS / 数据文件内联成一个自包含的
HTML，输出到 dist/techtree-standalone.html。

用途：需要发邮件、丢共享盘、或放到没有目录结构的地方时。
日常维护还是用拆分版本更方便——单文件是快照，改了 data/ 要重新打包。

只用 Python 标准库，不需要 node、npm 或任何依赖：
    python3 tools/build.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "techtree.html"
OUT = ROOT / "dist" / "techtree-standalone.html"

# 内联脚本时需要防止内容里出现 </script> 提前闭合标签
def guard(js: str) -> str:
    return js.replace("</script", "<\\/script")


def main() -> int:
    if not SRC.exists():
        print(f"找不到 {SRC}", file=sys.stderr)
        return 1

    html = SRC.read_text(encoding="utf-8")
    missing = []

    # --- 内联样式表 ---
    def css_repl(m):
        href = m.group(1)
        f = ROOT / href
        if not f.exists():
            missing.append(href)
            return m.group(0)
        return f"<style>\n/* ==== {href} ==== */\n{f.read_text(encoding='utf-8')}\n</style>"

    html = re.sub(r'<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>', css_repl, html)

    # --- 内联脚本（含 data/ 数据文件） ---
    def js_repl(m):
        src = m.group(1)
        f = ROOT / src
        if not f.exists():
            missing.append(src)
            return m.group(0)
        return f"<script>\n/* ==== {src} ==== */\n{guard(f.read_text(encoding='utf-8'))}\n</script>"

    html = re.sub(r'<script[^>]*src="([^"]+)"[^>]*>\s*</script>', js_repl, html)

    # --- 单位档案文件在运行时才动态加载，这里要提前内联进来 ---
    reg_file = ROOT / "data" / "orgs" / "index.js"
    org_files = []
    if reg_file.exists():
        org_files = re.findall(r"file:\s*'([^']+)'", reg_file.read_text(encoding="utf-8"))

    inlined = []
    for rel in org_files:
        f = ROOT / rel
        if not f.exists():
            missing.append(rel)
            continue
        inlined.append(f"<script>\n/* ==== {rel} ==== */\n{guard(f.read_text(encoding='utf-8'))}\n</script>")

    if inlined:
        marker = "<!-- 程序 -->"
        block = "<!-- 单位档案（单文件版已提前内联，运行时不再动态加载） -->\n" + "\n".join(inlined) + "\n\n" + marker
        if marker in html:
            html = html.replace(marker, block, 1)
        else:
            html = html.replace("</body>", block + "\n</body>", 1)

    html = html.replace(
        "<title>金融科技树",
        "<!-- 由 tools/build.py 打包生成的单文件版本，改动请回到拆分源码 -->\n<title>金融科技树",
        1,
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(html, encoding="utf-8")

    size = OUT.stat().st_size
    print(f"✔ 已生成 {OUT.relative_to(ROOT)}  （{size/1024:.0f} KB）")
    print(f"  内联 {len(org_files)} 份单位档案")
    if missing:
        print("⚠ 以下文件没找到，未能内联：")
        for x in missing:
            print("   ·", x)
        return 1
    leftover = re.findall(r'<(?:script|link)\b[^>]*\b(?:src|href)="(?!data:|https?://)([^"]+)"', html)
    if leftover:
        print("⚠ 输出中仍有未内联的本地引用：", ", ".join(sorted(set(leftover))))
        return 1
    print("  已确认无外部依赖，可单独分发。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
