import { Check, ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';

export type SelectMenuOption = {
  value: string;
  label: string;
  meta?: string;
  lang?: string;
  dir?: 'ltr' | 'rtl' | 'auto';
};

type SelectMenuProps = {
  value: string;
  options: SelectMenuOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  compact?: boolean;
};

type PopoverPlacement = {
  style: CSSProperties;
  placement: 'top' | 'bottom';
};

const VIEWPORT_GUTTER = 12;
const POPOVER_GAP = 8;
const MIN_MENU_HEIGHT = 180;
const DEFAULT_MENU_MAX_HEIGHT = 330;

export default function SelectMenu({ value, options, onChange, ariaLabel, className = '', compact = false }: SelectMenuProps) {
  const [open, setOpen] = useState(false);
  const [popoverPlacement, setPopoverPlacement] = useState<PopoverPlacement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();
  const selected = options.find((option) => option.value === value) ?? options[0];
  const isLanguageSelect = className.split(/\s+/).includes('language-select');

  const updatePopoverPosition = useCallback(() => {
    const trigger = buttonRef.current;
    if (!trigger) return;

    const triggerRect = trigger.getBoundingClientRect();
    const languageCluster = isLanguageSelect
      ? (rootRef.current?.closest('.header-actions') as HTMLElement | null)
      : null;
    const anchorRect = languageCluster?.getBoundingClientRect() ?? triggerRect;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const availableWidth = Math.max(160, viewportWidth - VIEWPORT_GUTTER * 2);
    const preferredWidth = isLanguageSelect
      ? Math.min(Math.max(anchorRect.width, 230), 360)
      : triggerRect.width;
    const width = Math.min(preferredWidth, availableWidth);

    let left: number;
    if (isLanguageSelect) {
      // The language menu belongs to the whole language + theme control cluster.
      // LTR aligns the menu with the cluster's left edge; RTL aligns its right edge.
      const pageDirection = document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';
      left = pageDirection === 'rtl' ? anchorRect.right - width : anchorRect.left;
    } else {
      // Regular field menus stay attached to their own trigger.
      const anchorOnRight = triggerRect.left + triggerRect.width / 2 > viewportWidth / 2;
      left = anchorOnRight ? triggerRect.right - width : triggerRect.left;
    }
    left = Math.max(VIEWPORT_GUTTER, Math.min(left, viewportWidth - VIEWPORT_GUTTER - width));

    const roomBelow = viewportHeight - anchorRect.bottom - POPOVER_GAP - VIEWPORT_GUTTER;
    const roomAbove = anchorRect.top - POPOVER_GAP - VIEWPORT_GUTTER;
    const shouldOpenAbove = roomBelow < MIN_MENU_HEIGHT && roomAbove > roomBelow;
    const maxHeight = Math.max(120, Math.min(DEFAULT_MENU_MAX_HEIGHT, shouldOpenAbove ? roomAbove : roomBelow));

    setPopoverPlacement({
      placement: shouldOpenAbove ? 'top' : 'bottom',
      style: {
        position: 'fixed',
        left: `${Math.round(left)}px`,
        width: `${Math.round(width)}px`,
        maxHeight: `${Math.floor(maxHeight)}px`,
        ...(shouldOpenAbove
          ? { bottom: `${Math.round(viewportHeight - anchorRect.top + POPOVER_GAP)}px` }
          : { top: `${Math.round(anchorRect.bottom + POPOVER_GAP)}px` }),
      },
    });
  }, [isLanguageSelect]);

  useLayoutEffect(() => {
    if (!open) {
      setPopoverPlacement(null);
      return;
    }
    updatePopoverPosition();
  }, [open, updatePopoverPosition]);

  useEffect(() => {
    if (!open) return;

    const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
    window.requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus());

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popoverRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onViewportChange = () => updatePopoverPosition();

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('scroll', onViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onViewportChange);
      window.removeEventListener('scroll', onViewportChange, true);
    };
  }, [open, options, updatePopoverPosition, value]);

  const popover = open && popoverPlacement
    ? createPortal(
        <div
          ref={popoverRef}
          className={`select-menu-popover select-menu-portal-popover ${isLanguageSelect ? 'language-select-popover' : ''} ${popoverPlacement.placement === 'top' ? 'opens-top' : 'opens-bottom'}`}
          id={menuId}
          role="listbox"
          aria-label={ariaLabel}
          style={popoverPlacement.style}
        >
          {options.map((option, index) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                ref={(node) => { optionRefs.current[index] = node; }}
                type="button"
                role="option"
                aria-selected={active}
                className={`select-menu-option ${active ? 'active' : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    const offset = event.key === 'ArrowDown' ? 1 : -1;
                    const nextIndex = (index + offset + options.length) % options.length;
                    optionRefs.current[nextIndex]?.focus();
                  } else if (event.key === 'Home') {
                    event.preventDefault();
                    optionRefs.current[0]?.focus();
                  } else if (event.key === 'End') {
                    event.preventDefault();
                    optionRefs.current[options.length - 1]?.focus();
                  }
                }}
              >
                <span className="select-menu-option-copy" lang={option.lang} dir={option.dir ?? 'auto'}>
                  <strong>{option.label}</strong>
                  {option.meta && <small>{option.meta}</small>}
                </span>
                {active && <Check aria-hidden="true" size={17} />}
              </button>
            );
          })}
        </div>,
        document.body,
      )
    : null;

  return (
    <div className={`select-menu ${compact ? 'select-menu-compact' : ''} ${className}`} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`select-menu-trigger ${open ? 'is-open' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span className="select-menu-trigger-copy" lang={selected?.lang} dir={selected?.dir ?? 'auto'}>
          <strong>{selected?.label}</strong>
          {selected?.meta && <small>{selected.meta}</small>}
        </span>
        <ChevronDown className="select-menu-chevron" aria-hidden="true" size={18} />
      </button>
      {popover}
    </div>
  );
}
