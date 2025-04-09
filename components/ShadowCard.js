import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Surface } from 'react-native-paper';

export default function ShadowCard({ children, style, contentStyle }) {
  return (
    <View style={[styles.shadowContainer, style]}>
      <Surface style={styles.surface}>
        <View style={[styles.innerContent, contentStyle]}>
          {children}
        </View>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowContainer: {
    marginVertical: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      }
    }),
  },
  surface: {
    borderRadius: 16,
  },
  innerContent: {
    borderRadius: 16,
    backgroundColor: '#141414',
  }
});