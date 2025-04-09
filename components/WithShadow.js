import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';

export default function WithShadow({ children, style, shadowColor = '#000', shadowOpacity = 0.15, elevation = 4 }) {
  return (
    <View style={[
      styles.container,
      {
        ...Platform.select({
          ios: {
            shadowColor,
            shadowOpacity,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 10,
          },
          android: {
            elevation,
          }
        }),
      },
      style
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 0,
  }
});