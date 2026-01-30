import React from 'react';

interface MenuItem {
  label: string;
  onClick: () => void;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

const ContextMenu = ({ x, y, items, onClose }: ContextMenuProps) => {
  React.useEffect(() => {
    const handleClickOutside = () => onClose();
    window.addEventListener('click', handleClickOutside);
    return () => {
      window.removeEventListener('click', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
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
            onClick={item.onClick}
            style={{ padding: '8px 15px', cursor: 'pointer' }}
            className="context-menu-item"
          >
            {item.label}
          </li>
        ))}
      </ul>
      <style>{`
        .context-menu-item:hover {
          background-color: #f0f0f0;
        }
      `}</style>
    </div>
  );
};

export default ContextMenu;
