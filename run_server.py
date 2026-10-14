"""
智馳光儲 · 早鳥預警拓客 AI 戰情室 一鍵啟動腳本
啟動 Uvicorn 本地伺服器並自動開啟瀏覽器展示 Web 應用
"""

import sys
import time
import webbrowser
import uvicorn
from pathlib import Path

# 設定 UTF-8
sys.stdout.reconfigure(encoding='utf-8')

def main():
    port = 8088
    host = "127.0.0.1"
    url = f"http://{host}:{port}"
    
    print("=" * 65)
    print("🚀 正在啟動【智馳光儲 · 早鳥預警拓客 AI 戰情室】...")
    print(f"📡 服務位址：{url}")
    print("=" * 65)

    # 稍作延遲後開啟瀏覽器
    def open_browser():
        time.sleep(1.2)
        print(f"🌐 正在為您開啟瀏覽器：{url}")
        webbrowser.open(url)

    import threading
    t = threading.Thread(target=open_browser, daemon=True)
    t.start()

    # 啟動 Uvicorn 服務
    uvicorn.run("server:app", host=host, port=port, log_level="info")

if __name__ == "__main__":
    main()
