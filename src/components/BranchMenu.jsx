import "./InteractivePlayer.css";

export default function BranchMenu({ config, phase, onBranchSelect, onGoTop }) {
  const { company, flow, theme } = config;

  return (
    <div className="branch-menu">
      <div className="branch-menu__inner">
        <div className="branch-menu__header">
          <div className="branch-menu__company">{company.name}</div>
          <div className="branch-menu__tagline">{company.tagline}</div>
          <div className="branch-menu__prompt">気になるボタンをタッチ</div>
        </div>

        <div className="branch-menu__buttons">
          {flow.branches.map((branch) => (
            <button
              key={branch.id}
              className="branch-btn"
              style={{ "--primary": theme.primary }}
              onClick={() => onBranchSelect(branch)}
            >
              <span className="branch-btn__label">{branch.label}</span>
              <span className="branch-btn__sublabel">{branch.sublabel} →</span>
            </button>
          ))}

          {phase === "end_menu" && (
            <button
              className="branch-btn branch-btn--top"
              style={{ "--primary": theme.primary }}
              onClick={onGoTop}
            >
              <span className="branch-btn__label">トップへ戻る</span>
              <span className="branch-btn__sublabel">Top →</span>
            </button>
          )}
        </div>

        <div className="branch-menu__contacts">
          <a href={`tel:${company.phone}`} className="contact-link">
            📞 {company.phone}
          </a>
          <a
            href={company.contactUrl}
            className="contact-link"
            target="_blank"
            rel="noreferrer"
          >
            ✉ お問い合わせ
          </a>
        </div>
      </div>
    </div>
  );
}
