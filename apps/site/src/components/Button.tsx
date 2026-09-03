import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

/** Botão primário do design system. */
export function Button({
  children,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`w-1/2 cursor-pointer rounded-full bg-[#6126F1] p-2 text-white shadow-lg hover:bg-[#4107d4] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#6126F1] ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
