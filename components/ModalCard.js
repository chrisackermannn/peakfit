// components/ModalCard.js
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Surface } from 'react-native-paper';

export default function ModalCard({ children, style }) {
  return (
    <View style={[styles.container, style]}>
      <Surface style={styles.surface}>
        <View style={styles.content}>
          {children}
        </View>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      }
    }),
  },
  surface: {
    borderRadius: 20,
  },
  content: {
    borderRadius: 20,
    // No overflow property
  }
});