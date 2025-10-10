import React, { createContext, useContext, useReducer, useEffect } from 'react';

const ThemeContext = createContext();

const themeReducer = (state, action) => {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'SET_BRAND':
      return { ...state, brand: action.payload };
    case 'TOGGLE_THEME':
      return { ...state, theme: state.theme === 'dark' ? 'light' : 'dark' };
    case 'SET_PRIMARY_COLOR':
      return { ...state, primaryColor: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
};

const brandColors = {
  fanz: '#7C4DFF',
  boyfanz: '#FF1744',
  girlfanz: '#FF2D95',
  pupfanz: '#39FF14',
  daddies: '#276EF1',
  cougarfanz: '#FFD600',
  taboofanz: '#9C27FF'
};

const initialState = {
  theme: 'dark', // FANZ uses dark theme by default
  brand: 'fanz',
  primaryColor: brandColors.fanz,
  loading: false
};

export const ThemeProvider = ({ children }) => {
  const [state, dispatch] = useReducer(themeReducer, initialState);

  useEffect(() => {
    // Load theme preferences from localStorage
    const savedTheme = localStorage.getItem('fanz_theme') || 'dark';
    const savedBrand = localStorage.getItem('fanz_brand') || 'fanz';
    
    dispatch({ type: 'SET_THEME', payload: savedTheme });
    dispatch({ type: 'SET_BRAND', payload: savedBrand });
    dispatch({ type: 'SET_PRIMARY_COLOR', payload: brandColors[savedBrand] });
    
    // Apply theme to document
    applyThemeToDocument(savedTheme, savedBrand);
  }, []);

  useEffect(() => {
    // Save theme changes to localStorage and apply to document
    localStorage.setItem('fanz_theme', state.theme);
    localStorage.setItem('fanz_brand', state.brand);
    applyThemeToDocument(state.theme, state.brand);
  }, [state.theme, state.brand]);

  const applyThemeToDocument = (theme, brand) => {
    const root = document.documentElement;
    
    // Remove existing theme and brand classes
    root.classList.remove('theme-light', 'theme-dark');
    Object.keys(brandColors).forEach(b => root.classList.remove(`brand-${b}`));
    
    // Apply new theme and brand
    root.classList.add(`theme-${theme}`);
    root.classList.add(`brand-${brand}`);
    
    // Set CSS custom properties
    root.style.setProperty('--primary-color', brandColors[brand]);
    root.style.setProperty('--brand-color', brandColors[brand]);
    
    // Set theme-specific colors
    if (theme === 'dark') {
      root.style.setProperty('--bg-primary', '#0a0a0a');
      root.style.setProperty('--bg-secondary', '#12131a');
      root.style.setProperty('--text-primary', '#f7f7ff');
      root.style.setProperty('--text-secondary', '#bdbdd1');
      root.style.setProperty('--border-color', 'rgba(247,247,251,.1)');
    } else {
      root.style.setProperty('--bg-primary', '#ffffff');
      root.style.setProperty('--bg-secondary', '#f8f9fa');
      root.style.setProperty('--text-primary', '#212529');
      root.style.setProperty('--text-secondary', '#6c757d');
      root.style.setProperty('--border-color', 'rgba(0,0,0,.1)');
    }
  };

  const setTheme = (theme) => {
    dispatch({ type: 'SET_THEME', payload: theme });
  };

  const setBrand = (brand) => {
    if (brandColors[brand]) {
      dispatch({ type: 'SET_BRAND', payload: brand });
      dispatch({ type: 'SET_PRIMARY_COLOR', payload: brandColors[brand] });
    }
  };

  const toggleTheme = () => {
    dispatch({ type: 'TOGGLE_THEME' });
  };

  const value = {
    ...state,
    brandColors,
    setTheme,
    setBrand,
    toggleTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};