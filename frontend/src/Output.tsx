import Markdown from "react-markdown";

export function Output({ text }: { text: string }) {
  return (
    <div className="markdown">
      <Markdown>{text}</Markdown>
    </div>
  );
}
