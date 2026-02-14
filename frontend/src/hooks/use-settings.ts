/**
 * useSettings Hook
 * 
 * Manages application settings state and API calls.
 */

import { useState, useEffect, useCallback } from 'react';
import { settingsApi } from '../services/api';
import type { 
  Settings, 
  JiraConfig, 
  LLMConfig, 
  JiraSettingsFormData,
  LLMSettingsFormData,
  LoadingState 
} from '../types';

interface UseSettingsReturn {
  settings: Settings | null;
  loading: LoadingState;
  error: string | null;
  fetchSettings: () => Promise<void>;
  saveJiraSettings: (data: JiraSettingsFormData) => Promise<void>;
  testJiraConnection: () => Promise<{ success: boolean; message: string; user?: string }>;
  saveLLMSettings: (data: LLMSettingsFormData) => Promise<void>;
  testLLMConnection: (provider: 'groq' | 'ollama') => Promise<{ success: boolean; message: string; models?: string[] }>;
  getOllamaModels: () => Promise<string[]>;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState<LoadingState>('idle');
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading('loading');
    setError(null);

    try {
      const [jiraRes, llmRes] = await Promise.all([
        settingsApi.getJiraSettings(),
        settingsApi.getLLMSettings(),
      ]);

      const newSettings: Settings = {
        jira: jiraRes.data,
        llm: llmRes.data,
      };

      setSettings(newSettings);
      setLoading('success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load settings';
      setError(message);
      setLoading('error');
    }
  }, []);

  const saveJiraSettings = async (data: JiraSettingsFormData) => {
    setLoading('loading');
    setError(null);

    try {
      await settingsApi.saveJiraSettings(data);
      await fetchSettings(); // Refresh settings
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save JIRA settings';
      setError(message);
      setLoading('error');
      throw new Error(message);
    }
  };

  const testJiraConnection = async () => {
    try {
      const res = await settingsApi.testJiraConnection();
      if (res.success) {
        await fetchSettings(); // Refresh to update connection status
      }
      return {
        success: res.success,
        message: res.message,
        user: res.data?.user,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed';
      return { success: false, message };
    }
  };

  const saveLLMSettings = async (data: LLMSettingsFormData) => {
    setLoading('loading');
    setError(null);

    try {
      await settingsApi.saveLLMSettings(data);
      await fetchSettings(); // Refresh settings
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save LLM settings';
      setError(message);
      setLoading('error');
      throw new Error(message);
    }
  };

  const testLLMConnection = async (provider: 'groq' | 'ollama') => {
    try {
      const res = await settingsApi.testLLMConnection(provider);
      return {
        success: res.success,
        message: res.message,
        models: res.data?.models,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed';
      return { success: false, message };
    }
  };

  const getOllamaModels = async () => {
    try {
      const res = await settingsApi.getOllamaModels();
      return res.data;
    } catch (err) {
      return [];
    }
  };

  // Load settings on mount
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    fetchSettings,
    saveJiraSettings,
    testJiraConnection,
    saveLLMSettings,
    testLLMConnection,
    getOllamaModels,
  };
}

export default useSettings;
