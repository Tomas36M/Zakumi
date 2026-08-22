// Iconos de línea del portal (16px, stroke currentColor). Inline a propósito:
// el repo no carga librería de iconos y estos son los únicos que se usan.

type Props = { size?: number };

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

export function IconoInicio({ size = 16 }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
    </svg>
  );
}

export function IconoTienda({ size = 16 }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M4 8h16l-1.2 12.2a1 1 0 0 1-1 .8H6.2a1 1 0 0 1-1-.8L4 8Z" />
      <path d="M8.5 10V6a3.5 3.5 0 0 1 7 0v4" />
    </svg>
  );
}

export function IconoSolicitudes({ size = 16 }: Props) {
  return (
    <svg {...base(size)}>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M9 8.5h6M9 12.5h6M9 16.5h3.5" />
    </svg>
  );
}

export function IconoBot({ size = 16 }: Props) {
  return (
    <svg {...base(size)}>
      <rect x="4" y="7" width="16" height="12" rx="3" />
      <path d="M12 7V3.5M8.5 3.5h7" />
      <circle cx="9" cy="13" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconoVentas({ size = 16 }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M4 20V10M10 20V4M16 20v-8M21 20H3" />
    </svg>
  );
}

export function IconoPagos({ size = 16 }: Props) {
  return (
    <svg {...base(size)}>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M7 15h4" />
    </svg>
  );
}

export function IconoAjustes({ size = 16 }: Props) {
  return (
    <svg {...base(size)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6" />
    </svg>
  );
}

export function IconoSalir({ size = 16 }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
      <path d="m17 8 4 4-4 4M21 12H9" />
    </svg>
  );
}

export function IconoChevron({ size = 12 }: Props) {
  return (
    <svg {...base(size)}>
      <path d="m14 6-6 6 6 6" />
    </svg>
  );
}

export function IconoMenu({ size = 18 }: Props) {
  return (
    <svg {...base(size)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function IconoCerrar({ size = 16 }: Props) {
  return (
    <svg {...base(size)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}
