import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Home, MessageSquare, BookOpen, Settings } from 'lucide-react-native';

import { useAuthStore } from './src/store/authStore';
import { useSettingsStore } from './src/store/settingsStore';
import { useWikiStore } from './src/store/wikiStore';
import { initWikiFileSystem } from './src/services/wiki';
import { Colors } from './src/constants/colors';

// ─── 认证流程 ─────────────────────────────────────────────────────────────────
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';

// ─── 主 App 页面 ──────────────────────────────────────────────────────────────
import HomeScreen from './src/screens/HomeScreen';
import ChatScreen from './src/screens/ChatScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import LintScreen from './src/screens/LintScreen';
import SystemFilesScreen from './src/screens/SystemFilesScreen';
import SearchScreen from './src/screens/SearchScreen';

// ─── Wiki 栈 ──────────────────────────────────────────────────────────────────
import WikiListScreen from './src/screens/wiki/WikiListScreen';
import WikiDetailScreen from './src/screens/wiki/WikiDetailScreen';
import WikiNewScreen from './src/screens/wiki/WikiNewScreen';
import WikiEditScreen from './src/screens/wiki/WikiEditScreen';

import {
  AuthStackParamList,
  MainTabParamList,
  WikiStackParamList,
  RootStackParamList,
} from './src/types';

// ─── 扩展导航参数类型 ─────────────────────────────────────────────────────────

export type RootStackExtParamList = {
  Main: undefined;
  Auth: undefined;
  Lint: undefined;
  SystemFiles: undefined;
  Search: undefined;
};

export type WikiStackExtParamList = WikiStackParamList;

const AuthStack = createStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const WikiStack = createStackNavigator<WikiStackParamList>();
const RootStack = createStackNavigator<RootStackExtParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function WikiNavigator() {
  return (
    <WikiStack.Navigator screenOptions={{ headerShown: false }}>
      <WikiStack.Screen name="WikiList" component={WikiListScreen} />
      <WikiStack.Screen name="WikiDetail" component={WikiDetailScreen} />
      <WikiStack.Screen name="WikiNew" component={WikiNewScreen} />
      <WikiStack.Screen name="WikiEdit" component={WikiEditScreen} />
    </WikiStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.text.tertiary,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: Colors.border,
          borderTopWidth: 0.5,
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          marginTop: -2,
        },
        tabBarIcon: ({ color, size }) => {
          const iconSize = size - 2;
          if (route.name === 'Home') return <Home size={iconSize} color={color} />;
          if (route.name === 'Chat') return <MessageSquare size={iconSize} color={color} />;
          if (route.name === 'Wiki') return <BookOpen size={iconSize} color={color} />;
          if (route.name === 'Settings') return <Settings size={iconSize} color={color} />;
          return null;
        },
      })}
    >
      <MainTab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: '首页' }} />
      <MainTab.Screen name="Chat" component={ChatScreen} options={{ tabBarLabel: '对话' }} />
      <MainTab.Screen name="Wiki" component={WikiNavigator} options={{ tabBarLabel: 'Wiki' }} />
      <MainTab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ tabBarLabel: '设置' }}
      />
    </MainTab.Navigator>
  );
}

function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <RootStack.Screen name="Main" component={MainNavigator} />
          <RootStack.Screen
            name="Lint"
            component={LintScreen}
            options={{ presentation: 'modal' }}
          />
          <RootStack.Screen
            name="SystemFiles"
            component={SystemFilesScreen}
            options={{ presentation: 'modal' }}
          />
          <RootStack.Screen
            name="Search"
            component={SearchScreen}
            options={{ presentation: 'modal' }}
          />
        </>
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  );
}

export default function App() {
  const { loadStoredAuth } = useAuthStore();
  const { loadSettings } = useSettingsStore();
  const { loadPages } = useWikiStore();

  useEffect(() => {
    async function init() {
      await Promise.all([loadStoredAuth(), loadSettings()]);
      await initWikiFileSystem();
      await loadPages();
    }
    init().catch(console.error);
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
