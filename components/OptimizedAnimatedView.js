import React from 'react';
import { Animated, Platform } from 'react-native';

// Higher-order component to apply optimal animations
export const OptimizedAnimatedView = ({ style, children, ...props }) => {
  // Remove any problematic style properties on iOS that prevent hardware acceleration
  const optimizedStyle = Platform.OS === 'ios' 
    ? { 
        ...style, 
        shadowOpacity: undefined, 
        shadowRadius: undefined, 
        shadowOffset: undefined,
        shadowColor: undefined,
      } 
    : style;

  return (
    <Animated.View style={optimizedStyle} {...props}>
      {children}
    </Animated.View>
  );
};