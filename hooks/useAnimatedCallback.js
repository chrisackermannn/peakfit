import { useCallback } from 'react';
import { InteractionManager } from 'react-native';

export default function useAnimatedCallback(callback, deps = []) {
  return useCallback((...args) => {
    // Schedule long-running operations after animations
    InteractionManager.runAfterInteractions(() => {
      callback(...args);
    });
  }, deps);
}