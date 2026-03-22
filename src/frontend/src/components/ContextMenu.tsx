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

const listStyle: React.CSSProperties = { listStyle: 'none', margin: 0, padding: '5px 0' };

/**
 * Submenu container that uses a layout effect to detect bottom/right overflow and
 * reposition itself so it stays within the viewport.
 */
const SubMenuContainer = ({
  children,
  showLeft,
}: {
  children: React.ReactNode;
  showLeft: boolean;
}) => {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const vh = window.innerHeight;
    const MARGIN = 8;
    if (rect.bottom > vh - MARGIN) {
      // Shift upward so the bottom edge stays within the viewport
      const overflow = rect.bottom - (vh - MARGIN);
      ref.current.style.top = `-${overflow}px`;
    }
  });

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: 0,
        ...(showLeft ? { right: '100%', marginRight: 4 } : { left: '100%', marginLeft: 4 }),
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '4px',
        boxShadow: '2px 2px 5px rgba(0,0,0,0.1)',
        minWidth: 160,
        zIndex: 1001,
      }}
    >
      {children}
    </div>
  );
};

type ContextMenuListProps = {
  items: MenuItem[];
  onClose: () => void;
  isRoot?: boolean;
  showSubmenusLeft?: boolean;
};

const ContextMenuList = ({ items, onClose, isRoot = false, showSubmenusLeft = false }: ContextMenuListProps) => {
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
            <SubMenuContainer showLeft={showSubmenusLeft}>
              <ContextMenuList items={item.children} onClose={onClose} showSubmenusLeft={showSubmenusLeft} />
            </SubMenuContainer>
          ) : null}
        </li>
      ))}
    </ul>
  );
};

const MARGIN = 8;

const ContextMenu = ({ x, y, items, onClose }: ContextMenuProps) => {
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);
  const [showSubmenusLeft, setShowSubmenusLeft] = React.useState(false);

  // useLayoutEffect so position is corrected before the browser paints — no flash
  React.useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const clampedLeft = Math.max(MARGIN, Math.min(x, vw - rect.width - MARGIN));
    const clampedTop = Math.max(MARGIN, Math.min(y, vh - rect.height - MARGIN));
    setPos({ left: clampedLeft, top: clampedTop });
    setShowSubmenusLeft(clampedLeft + rect.width + 180 > vw);
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
        top: pos ? pos.top : y,
        left: pos ? pos.left : x,
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '4px',
        zIndex: 1000,
        boxShadow: '2px 2px 5px rgba(0,0,0,0.1)',
        // Hide until positioned to avoid flash at wrong location
        visibility: pos ? 'visible' : 'hidden',
      }}
    >
      <ContextMenuList items={items} onClose={onClose} isRoot showSubmenusLeft={showSubmenusLeft} />
    </div>
  );
};

export default ContextMenu;
