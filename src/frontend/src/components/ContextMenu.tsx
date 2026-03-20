import React from 'react';

interface MenuItem {
  label: string;
  onClick?: () => void;
  children?: MenuItem[];
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

type ContextMenuListProps = {
  items: MenuItem[];
  onClose: () => void;
  isRoot?: boolean;
};

const listStyle: React.CSSProperties = { listStyle: 'none', margin: 0, padding: '5px 0' };

const ContextMenuList = ({ items, onClose, isRoot = false }: ContextMenuListProps) => {
  const [openSubmenuIndex, setOpenSubmenuIndex] = React.useState<number | null>(null);

  return (
    <ul style={listStyle}>
      {items.map((item, index) => (
        <li
          key={`${item.label}-${index}`}
          onClick={(event) => {
            event.stopPropagation();
            if (item.children?.length) {
              setOpenSubmenuIndex((prev) => (prev === index ? null : index));
              return;
            }
            item.onClick?.();
            onClose();
          }}
          onMouseEnter={() => setOpenSubmenuIndex(item.children?.length ? index : null)}
          style={{
            padding: '8px 15px',
            cursor: 'pointer',
            userSelect: 'none',
            position: 'relative',
            whiteSpace: 'nowrap',
            backgroundColor: isRoot ? 'transparent' : '#fff',
          }}
          className="context-menu-item"
        >
          <span>{item.label}</span>
          {item.children?.length ? <span style={{ marginLeft: 12 }}>▶</span> : null}
          {item.children?.length && openSubmenuIndex === index ? (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '100%',
                marginLeft: 4,
                backgroundColor: 'white',
                border: '1px solid #ccc',
                borderRadius: '4px',
                boxShadow: '2px 2px 5px rgba(0,0,0,0.1)',
                minWidth: 160,
                zIndex: 1001,
              }}
            >
              <ContextMenuList items={item.children} onClose={onClose} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
};

const MARGIN = 8;

const ContextMenu = ({ x, y, items, onClose }: ContextMenuProps) => {
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = React.useState({ left: x, top: y });

  React.useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clampedLeft = Math.max(MARGIN, Math.min(x, vw - rect.width - MARGIN));
    const clampedTop = Math.max(MARGIN, Math.min(y, vh - rect.height - MARGIN));
    setPos({ left: clampedLeft, top: clampedTop });
  }, [x, y]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (menuRef.current && target && menuRef.current.contains(target)) {
        return;
      }
      onClose();
    };
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '4px',
        zIndex: 1000,
        boxShadow: '2px 2px 5px rgba(0,0,0,0.1)',
      }}
    >
      <ContextMenuList items={items} onClose={onClose} isRoot />
    </div>
  );
};

export default ContextMenu;
