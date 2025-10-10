import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

const themes = {
  dark: {
    name: 'dark',
    colors: {
      primary: '#7C4DFF',
      secondary: '#00D1FF',
      accent: '#FF3D71',
      background: '#0a0a0a',
      surface: '#12131a',
      text: '#f7f7ff',
      textSecondary: '#bdbdd1',
      border: '#2a2b3a',
      success: '#39ff14',
      warning: '#ffd600',
      error: '#ff1744',
      info: '#00D1FF'
    }
  },
  light: {
    name: 'light',
    colors: {
      primary: '#7C4DFF',
      secondary: '#00D1FF',
      accent: '#FF3D71',
      background: '#ffffff',
      surface: '#f8f9fa',
      text: '#1a1a1a',
      textSecondary: '#6c757d',
      border: '#e0e0e0',
      success: '#28a745',
      warning: '#ffc107',
      error: '#dc3545',
      info: '#17a2b8'
    }
  }
};

const brands = {
  fanz: {
    name: 'FANZ',
    primary: '#7C4DFF',
    secondary: '#00D1FF',
    accent: '#FF3D71'
  },
  boyfanz: {
    name: 'BoyFanz',
    primary: '#ff1744',
    secondary: '#ff5722',
    accent: '#e91e63'
  },
  girlfanz: {
    name: 'GirlFanz',
    primary: '#ff2d95',
    secondary: '#e91e63',
    accent: '#9c27b0'
  },
  pupfanz: {
    name: 'PupFanz',
    primary: '#39ff14',
    secondary: '#4caf50',
    accent: '#8bc34a'
  },
  daddies: {
    name: 'DaddiesFanz',
    primary: '#276ef1',
    secondary: '#2196f3',
    accent: '#03a9f4'
  },
  cougarfanz: {
    name: 'CougarFanz',
    primary: '#ffd600',
    secondary: '#ffeb3b',
    accent: '#ffc107'
  },
  taboofanz: {
    name: 'TabooFanz',
    primary: '#9c27ff',
    secondary: '#9c27b0',
    accent: '#673ab7'
  }
};

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState('dark');
  const [currentBrand, setCurrentBrand] = useState('fanz');

  useEffect(() => {
    // Load saved theme and brand from localStorage
    const savedTheme = localStorage.getItem('fanz_theme') || 'dark';
    const savedBrand = localStorage.getItem('fanz_brand') || 'fanz';
    setCurrentTheme(savedTheme);
    setCurrentBrand(savedBrand);
    
    // Apply theme to root element
    applyTheme(savedTheme, savedBrand);
  }, []);

  const applyTheme = (themeName, brandName) => {
    const theme = themes[themeName];
    const brand = brands[brandName];
    const root = document.documentElement;

    // Apply theme colors
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--color-${key}`, value);
    });

    // Apply brand colors
    root.style.setProperty('--brand-primary', brand.primary);
    root.style.setProperty('--brand-secondary', brand.secondary);
    root.style.setProperty('--brand-accent', brand.accent);

    // Apply theme class
    root.className = `theme-${themeName} brand-${brandName}`;
  };

  const setTheme = (themeName) => {
    setCurrentTheme(themeName);
    localStorage.setItem('fanz_theme', themeName);
    applyTheme(themeName, currentBrand);
  };

  const setBrand = (brandName) => {
    setCurrentBrand(brandName);
    localStorage.setItem('fanz_brand', brandName);
    applyTheme(currentTheme, brandName);
  };

  const toggleTheme = () => {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
  };

  const value = {
    theme: themes[currentTheme],
    brand: brands[currentBrand],
    currentTheme,
    currentBrand,
    themes,
    brands,
    setTheme,
    setBrand,
    toggleTheme
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}