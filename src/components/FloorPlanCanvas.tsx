import { type ReactNode, type Ref } from "react";

type FloorPlanCanvasProps = {
  floorPlanImage?: string | null;
  floorName?: string;
  placeholderText: string;
  svgSize?: number;
  wrapperRef?: Ref<HTMLDivElement>;
  wrapperClassName?: string;
  svgProps?: Omit<React.SVGProps<SVGSVGElement>, "viewBox" | "preserveAspectRatio" | "children">;
  children?: ReactNode;
};

export default function FloorPlanCanvas({
  floorPlanImage,
  floorName,
  placeholderText,
  svgSize = 1000,
  wrapperRef,
  wrapperClassName,
  svgProps,
  children,
}: FloorPlanCanvasProps) {
  const wrapperClass = ["ross-canvas-wrap", "ross-editor-canvas", wrapperClassName].filter(Boolean).join(" ");
  const svgClass = ["ross-overlay-svg", svgProps?.className].filter(Boolean).join(" ");

  return (
    <div className={wrapperClass} ref={wrapperRef}>
      <svg
        {...svgProps}
        className={svgClass}
        viewBox={`0 0 ${svgSize} ${svgSize}`}
        preserveAspectRatio="none"
      >
        {floorPlanImage ? (
          <image
            href={floorPlanImage}
            x="0"
            y="0"
            width={svgSize}
            height={svgSize}
            preserveAspectRatio="none"
            aria-label={floorName ?? "Floor plan"}
          />
        ) : null}
        {children}
      </svg>

      {!floorPlanImage ? <div className="ross-placeholder">{placeholderText}</div> : null}
    </div>
  );
}
