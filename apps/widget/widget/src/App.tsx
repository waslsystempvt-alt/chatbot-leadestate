import { mergeChatConfig } from "./lib/config";
import { ChatWidget } from "./components/ChatWidget";
import "./styles/chat-widget.css";
import "./styles/premium.css";
import "./styles/mobile-open.css";
import "./styles/root.css";

const cfg = mergeChatConfig();
const embedded =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("embed") === "1";

export default function App() {
  return (
    <div id="app-root">
      <ChatWidget config={cfg} embedded={embedded} />
    </div>
  );
}
