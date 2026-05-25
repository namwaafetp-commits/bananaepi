import { createContext, useContext, useState } from 'react'

const LangContext = createContext()

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem('epi_lang') || 'th')

  const toggle = () => setLang(l => {
    const next = l === 'th' ? 'en' : 'th'
    localStorage.setItem('epi_lang', next)
    return next
  })

  return <LangContext.Provider value={{ lang, toggle }}>{children}</LangContext.Provider>
}

export const useLang = () => useContext(LangContext)
