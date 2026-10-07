import type { SVGProps } from 'react';

export const ICON_PATHS = {
  menu:'<path d="M4 8.5h14M4 15.5h10"/>',
  temp:'<path d="M5.6 17.6A8 8 0 0 1 12 4a8 8 0 0 1 7.2 4.5M20 12a8 8 0 0 1-12.2 6.8L4 20l1.2-3.6"/>',
  share:'<path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5V18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5.5"/>',
  thumbs:'<g stroke-width="1.65"><path d="M5.1 6.9 8.4 1.8c.3-.5.7-.6 1.2-.4l.6.3c1.3.7 1.7 1.9 1.4 3.2L11 7h2.2a2.2 2.2 0 0 1 2.1 2.8l-1.1 4a2.5 2.5 0 0 1-2.4 1.9H4a2.6 2.6 0 0 1-2.6-2.6V9.6A2.6 2.6 0 0 1 4 7h1.1v8.2"/><path d="M18.9 17.1 15.6 22.2c-.3.5-.7.6-1.2.4l-.6-.3c-1.3-.7-1.7-1.9-1.4-3.2L13 17h-2.2M16.1 8.3H20a2.6 2.6 0 0 1 2.6 2.6v3.5A2.6 2.6 0 0 1 20 17h-1.1V8.8"/></g>',
  newchat:'<path d="M12 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V12"/><path d="M18.4 3.6a2 2 0 0 1 2.9 2.9L13 14.8l-3.9 1 1-3.9z"/>',
  chevD:'<path d="M6 9l6 6 6-6"/>', chevR:'<path d="M9 6l6 6-6 6"/>', chevL:'<path d="M15 6l-6 6 6 6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  up:'<path d="M12 19V5.5M6 11.5l6-6 6 6" stroke-width="2.2"/>',
  stop:'<rect x="6.85" y="6.85" width="10.3" height="10.3" rx="1.2" fill="currentColor" stroke="none"/>',
  pause:'<path d="M9 5v14M15 5v14" stroke-width="2.2"/>',
  play:'<path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  wave:'<path d="M6 10.5v3M10 8v8M14 5.5v13M18 9.5v5" stroke-width="2"/>',
  copy:'<rect x="3.3" y="8.3" width="12.2" height="12.2" rx="3.2"/><path d="M8.3 8.3V6.5a3.2 3.2 0 0 1 3.2-3.2h6a3.2 3.2 0 0 1 3.2 3.2v6a3.2 3.2 0 0 1-3.2 3.2h-2"/>',
  check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  thumbU:'<path d="M7 10v10H4.5A1.5 1.5 0 0 1 3 18.5v-7A1.5 1.5 0 0 1 4.5 10zM7 10l4-7a2.4 2.4 0 0 1 2.6 2.9L13 9h5.4a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 17 20H7"/>',
  thumbD:'<path d="M17 14V4h2.5A1.5 1.5 0 0 1 21 5.5v7a1.5 1.5 0 0 1-1.5 1.5zM17 14l-4 7a2.4 2.4 0 0 1-2.6-2.9L11 15H5.6a2 2 0 0 1-2-2.4l1.4-7A2 2 0 0 1 7 4h10"/>',
  speaker:'<path d="M11 5 6.5 9H4v6h2.5L11 19z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  regen:'<path d="M20 12a8 8 0 1 1-2.6-5.9L20 8.5"/><path d="M20 3.5v5h-5"/>',
  edit:'<path d="m3.7 20.3 1.5-5.6L15.8 4.1a2.9 2.9 0 0 1 4.1 4.1L9.3 18.8z"/><path d="m14.4 5.5 4.1 4.1"/>',
  search:'<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
  dots:'<circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  trash:'<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 12.5h9L17.5 7M10 11v5M14 11v5"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
  close:'<path d="M6 6l12 12M18 6 6 18"/>',
  arrowD:'<path d="M12 5v14M5.5 12.5 12 19l6.5-6.5"/>',
  camera:'<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.8l1.5-2h4.4l1.5 2h1.8A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.5"/>',
  image:'<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 16-5-5-9 8.5"/>',
  file:'<path d="M14 3.5H7.5A2.5 2.5 0 0 0 5 6v12a2.5 2.5 0 0 0 2.5 2.5h9A2.5 2.5 0 0 0 19 18V8.5z"/><path d="M14 3.5v5h5"/>',
  pin:'<path d="M9 4h6l-1 6 3.5 3.5v1.5H6.5v-1.5L10 10z"/><path d="M12 15v5"/>',
  rules:'<path d="M4 6h10M4 12h7M4 18h5"/><path d="M14.5 19.5 20 14l-2-2-5.5 5.5-.5 2.5z"/>'
} as const;

export type IconName = keyof typeof ICON_PATHS;

export const iconHtml = (name: IconName): string =>
  `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name]}</svg>`;

export interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
}

export function Icon({ name, className = 'i', ...props }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden={props['aria-label'] ? undefined : true}
      {...props}
      dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] }}
    />
  );
}
