# -*- coding: utf-8 -*-
"""YiQi@MD-Editor-wb-KimiK3 PyInstaller 打包脚本。

用法（在受管 venv 中）：
    C:/Users/xp772/.workbuddy/binaries/python/envs/default/Scripts/python.exe build.py

产物：release/YiQi@MD-Editor-wb-KimiK3-v1.0.0.exe（单文件、无控制台、内嵌 web/ 静态资源）
输出目录可通过环境变量 MOLAN_DISTPATH 覆盖（默认 dist/）。
"""
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))


def main() -> int:
    # 每次使用全新 workpath（沙箱策略下旧构建产物不可删除/覆盖）
    workpath = os.path.join("tools", "specbuild", "build_" + time.strftime("%Y%m%d_%H%M%S"))
    distpath = os.environ.get("MOLAN_DISTPATH", "dist")

    # 优先直接基于既有 spec 构建（避免重复 makespec，且 spec 中路径已固化）
    spec = os.path.join(HERE, "molan_app.spec")
    if os.path.isfile(spec):
        cmd = [
            sys.executable, "-m", "PyInstaller",
            "--noconfirm",
            "--workpath", workpath,
            "--distpath", distpath,
            spec,
        ]
    else:
        cmd = [
            sys.executable,
            "-m",
            "PyInstaller",
            "--onefile",
            "--noconsole",
            "--name",
            "YiQi@MD-Editor-wb-KimiK3-v1.0.0",
            "--add-data",
            "web;web",
            "--specpath",
            os.path.join("tools", "specbuild"),
            "--workpath",
            workpath,
            "--distpath",
            distpath,
            "main.py",
        ]
    print("[build] 工作目录:", HERE)
    print("[build] 命令:", " ".join(cmd))
    proc = subprocess.run(cmd, cwd=HERE)
    if proc.returncode != 0:
        print("[build] 打包失败，退出码:", proc.returncode)
        return proc.returncode
    exe = os.path.join(
        HERE, os.environ.get("MOLAN_DISTPATH", "dist"),
        "YiQi@MD-Editor-wb-KimiK3-v1.0.0.exe",
    )
    if os.path.isfile(exe):
        size_mb = os.path.getsize(exe) / 1024 / 1024
        print(f"[build] 打包成功: {exe} ({size_mb:.1f} MB)")
    else:
        print(f"[build] 警告: 未找到 {exe}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
