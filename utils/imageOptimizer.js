import { Platform, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');
const screenSize = Math.max(width, height);

export function optimizeImageUri(uri, size = 'medium') {
  if (!uri || typeof uri !== 'string') return uri;
  
  // Only process remote URLs, not local files
  if (!uri.startsWith('http')) return uri;
  
  // Default size multipliers
  const sizeMultipliers = {
    small: 0.5,
    medium: 1.0,
    large: 1.5
  };
  
  const multiplier = sizeMultipliers[size] || 1.0;
  const targetWidth = Math.round(screenSize * multiplier);
  
  // For Firebase Storage URLs, add _<width> before file extension
  if (uri.includes('firebasestorage.googleapis.com')) {
    return uri.replace(/(\.[^.]+)$/, `_${targetWidth}$1`);
  }
  
  // For other URLs, append query parameter
  const separator = uri.includes('?') ? '&' : '?';
  return `${uri}${separator}w=${targetWidth}&auto=format`;
}