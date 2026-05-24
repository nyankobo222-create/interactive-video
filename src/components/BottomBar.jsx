import "./InteractivePlayer.css";

export default function BottomBar({ config, onBranchSelect }) {
  const { company, flow, theme } = config;

  return (
    <div className="bottom-bar">
      <div className="bottom-bar__branches">
        {flow.branches.map((branch) => (
          <button
            key={branch.id}
            className="bottom-bar__btn"
            style={{ "--primary": theme.primary }}
            onClick={() => onBranchSelect(branch)}
          >
            {branch.label}
          </button>
        ))}
      </div>
      <div className="bottom-bar__contacts">
        <a href={`tel:${company.phone}`} className="bottom-bar__icon">📞</a>
        <a
          href={company.contactUrl}
          className="bottom-bar__icon"
          target="_blank"
          rel="noreferrer"
        >
          ✉
        </a>
      </div>
    </div>
  );
}
