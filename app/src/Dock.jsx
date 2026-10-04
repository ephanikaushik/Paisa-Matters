import { createContext, useContext } from 'react'
import { createPortal } from 'react-dom'

// The entry bar lives in a fixed slot between the scrolling screen and the tab bar, so it never covers content.
export const DockSlot = createContext(null)
export function Dock({ children }) {
  const slot = useContext(DockSlot)
  return slot ? createPortal(children, slot) : null
}
