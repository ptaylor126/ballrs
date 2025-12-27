import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { COUNTRIES, Country, countryCodeToFlag, searchCountries } from '../lib/countryUtils';
import { AnimatedButton } from '../components/AnimatedComponents';

interface Props {
  onComplete: () => void;
  onSkip: () => void;
}

export default function CountryPickerScreen({ onComplete, onSkip }: Props) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [saving, setSaving] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const filteredCountries = useMemo(() => {
    return searchCountries(searchQuery);
  }, [searchQuery]);

  const handleSelectCountry = (country: Country) => {
    setSelectedCountry(country);
  };

  const handleContinue = async () => {
    if (!user || !selectedCountry) return;

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ country: selectedCountry.code })
      .eq('id', user.id);

    setSaving(false);

    if (error) {
      console.error('Error saving country:', error);
    }

    onComplete();
  };

  const renderCountryItem = ({ item }: { item: Country }) => {
    const isSelected = selectedCountry?.code === item.code;

    return (
      <TouchableOpacity
        style={[styles.countryItem, isSelected && styles.countryItemSelected]}
        onPress={() => handleSelectCountry(item)}
        activeOpacity={0.7}
      >
        <Text style={styles.countryFlag}>{countryCodeToFlag(item.code)}</Text>
        <Text style={[styles.countryName, isSelected && styles.countryNameSelected]}>
          {item.name}
        </Text>
        {isSelected && (
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <Text style={styles.logo}>BALLRS</Text>
        <Text style={styles.title}>Where are you from?</Text>
        <Text style={styles.subtitle}>
          Your flag will appear on the leaderboard
        </Text>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <TextInput
            style={[styles.searchInput, inputFocused && styles.searchInputFocused]}
            placeholder="Search countries..."
            placeholderTextColor="#999999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            autoCapitalize="none"
            autoCorrect={false}
            selectionColor="#1ABC9C"
          />
        </View>

        {/* Country List */}
        <View style={styles.listContainer}>
          <FlatList
            data={filteredCountries}
            renderItem={renderCountryItem}
            keyExtractor={(item) => item.code}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
          />
        </View>

        {/* Continue Button */}
        <AnimatedButton
          style={[
            styles.continueButton,
            !selectedCountry && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedCountry || saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={[
              styles.continueButtonText,
              !selectedCountry && styles.continueButtonTextDisabled,
            ]}>
              Continue
            </Text>
          )}
        </AnimatedButton>

        {/* Skip Button */}
        <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2EB',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  logo: {
    fontSize: 32,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: 'DMSans_900Black',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'DMSans_400Regular',
    color: '#666666',
    textAlign: 'center',
    marginBottom: 24,
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    fontFamily: 'DMSans_400Regular',
    color: '#1A1A1A',
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  searchInputFocused: {
    borderColor: '#1ABC9C',
  },
  listContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
    marginBottom: 16,
  },
  listContent: {
    padding: 8,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  countryItemSelected: {
    backgroundColor: '#E8F5F1',
  },
  countryFlag: {
    fontSize: 24,
    marginRight: 12,
  },
  countryName: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'DMSans_500Medium',
    color: '#1A1A1A',
  },
  countryNameSelected: {
    fontFamily: 'DMSans_700Bold',
    color: '#1ABC9C',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1ABC9C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'DMSans_700Bold',
  },
  continueButton: {
    backgroundColor: '#1ABC9C',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  continueButtonDisabled: {
    backgroundColor: '#E8E8E8',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'DMSans_900Black',
  },
  continueButtonTextDisabled: {
    color: '#999999',
  },
  skipButton: {
    marginTop: 16,
    padding: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 14,
    fontFamily: 'DMSans_500Medium',
    color: '#666666',
  },
});
