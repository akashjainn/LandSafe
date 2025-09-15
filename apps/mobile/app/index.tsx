import { Link, Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View } from 'react-native'

export default function Index() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>LandSafe (Expo)</Text>
      <Text>Welcome! This is a starter screen for the native app.</Text>
      <Link href="/about">About</Link>
      <StatusBar style="light" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1221',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: '600',
  },
})
