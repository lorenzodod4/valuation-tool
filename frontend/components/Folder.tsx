"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import "./Folder.css";

type FolderStyle = CSSProperties & {
  "--folder-color": string;
};

interface FolderProps {
  color?: string;
  size?: number;
  items?: ReactNode[];
  className?: string;
  label?: string;
  defaultOpen?: boolean;
}

const Folder = ({
  color = "var(--accent)",
  size = 1,
  items = [],
  className = "",
  label = "Sections",
  defaultOpen = false,
}: FolderProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const menuId = useId();
  const folderStyle: FolderStyle = {
    "--folder-color": color,
    transform: `scale(${size})`,
    transformOrigin: "top left",
  };

  return (
    <nav
      className={`folder-shell ${open ? "open" : ""} ${className}`.trim()}
      style={folderStyle}
      aria-label={label}
    >
      <button
        type="button"
        className="folder-toggle"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="folder-icon" aria-hidden="true">
          <span className="folder-tab" />
          <span className="folder-body" />
        </span>
        <span className="folder-toggle-text">
          <span>{label}</span>
          <strong>
            {items.length} {items.length === 1 ? "section" : "sections"}
          </strong>
        </span>
      </button>

      <div id={menuId} className="folder-menu" hidden={!open}>
        {items.map((item, index) => (
          <div className="folder-menu-row" key={`${menuId}-${index}`}>
            {item}
          </div>
        ))}
      </div>
    </nav>
  );
};

export default Folder;
