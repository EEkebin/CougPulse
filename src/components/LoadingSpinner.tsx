type LoadingSpinnerProps = {
  className?: string;
};

export default function LoadingSpinner({ className = "" }: LoadingSpinnerProps) {
  return <span className={`ross-spinner ${className}`.trim()} aria-hidden="true" />;
}
