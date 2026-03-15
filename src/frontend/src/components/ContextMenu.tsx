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

const ContextMenu = ({ x, y, items, onClose }: ContextMenuProps) => {
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const [openSubmenuIndex, setOpenSubmenuIndex] = React.useState<number | null>(null);

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
        position: 'absolute',
        top: y,
        left: x,
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '4px',
        zIndex: 1000,
        boxShadow: '2px 2px 5px rgba(0,0,0,0.1)',
      }}
    >
      <ul style={{ listStyle: 'none', margin: 0, padding: '5px 0' }}>
        {items.map((item, index) => (
          <li
            key={index}
            onClick={(event) => {
              event.stopPropagation();
              if (item.children?.length) {
                setOpenSubmenuIndex((prev) => (prev === index ? null : index));
                return;
              }
              item.onClick?.();
            }}
            onMouseEnter={() => setOpenSubmenuIndex(item.children?.length ? index : null)}
            style={{
              padding: '8px 15px',
              cursor: 'pointer',
              userSelect: 'none',
              position: 'relative',
              whiteSpace: 'nowrap',
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
                <ul style={{ listStyle: 'none', margin: 0, padding: '5px 0' }}>
                  {item.children.map((child, childIndex) => (
                    <li
                      key={childIndex}
                      onClick={(event) => {
                        event.stopPropagation();
                        child.onClick?.();
                      }}
                      style={{ padding: '8px 15px', cursor: 'pointer', userSelect: 'none' }}
                    >
                      {child.label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ContextMenu;
