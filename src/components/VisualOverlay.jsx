import "./InteractivePlayer.css";

function getAction(btn) {
  if (btn.action) return btn.action;
  if (btn.branchId === "__top__") return "top";
  if (btn.branchId) return "branch";
  return "none";
}

export default function VisualOverlay({ overlay, branches, onBranchSelect, onGoTop }) {
  if (!overlay?.imageUrl || !overlay?.buttons?.length) return null;

  const opacity = overlay.opacity ?? 1;

  function handleClick(btn) {
    const action = getAction(btn);
    if (action === "top") {
      onGoTop?.();
    } else if (action === "url") {
      if (btn.url) window.open(btn.url, "_blank", "noopener");
    } else if (action === "branch") {
      const branch = (branches || []).find((b) => b.id === btn.branchId);
      if (branch) onBranchSelect(branch);
    }
  }

  return (
    <div className="visual-overlay">
      <img
        src={overlay.imageUrl}
        className="visual-overlay__img"
        draggable={false}
        alt=""
        style={{ opacity }}
      />
      {overlay.buttons.map((btn) => (
        <button
          key={btn.id}
          className="visual-overlay__btn"
          style={{
            left:   `${btn.x}%`,
            top:    `${btn.y}%`,
            width:  `${btn.width}%`,
            height: `${btn.height}%`,
          }}
          onClick={() => handleClick(btn)}
        />
      ))}
    </div>
  );
}
