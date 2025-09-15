import { Stack } from 'expo-router'
import { StyleSheet, Text, View } from 'react-native'

export default function About() {
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'About' }} />
      <Text style={styles.text}>About LandSafe Mobile</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  text: { fontSize: 18 },
})
