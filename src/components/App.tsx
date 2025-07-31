import React, { useCallback, useEffect, useState } from 'react';
import styled from 'styled-components';
import BiosenseSignalMonitor from './BiosenseSignalMonitor';
import SettingsBars from './SettingsBars';
import { Flex } from './shared/Flex';
import { useCameras, useDisableZoom, useExternalRequestBlocker } from '../hooks';
import UAParser from 'ua-parser-js';

const Container = styled(Flex)<{ isSettingsOpen: boolean }>`
  height: 100%;
  width: 100%;
  position: relative;
  flex-direction: column;
  justify-content: start;
  align-items: center;
  background-color: ${({ isSettingsOpen }) =>
    isSettingsOpen && 'rgba(0, 0, 0, 0.5)'};
`;

const App = () => {
  // External request blocker configuration
  const { getStats, resetStats } = useExternalRequestBlocker({
    enabled: true,
    blockMode: 'mock', // 'block' | 'mock' | 'log'
    allowStaticResources: true,
    allowedExternalDomains: [
      // Add any specific external domains your BioSense SDK needs
      // 'api.biosensesignal.com',
      // 'cdn.jsdelivr.net',
    ],
    onExternalBlocked: (url, method) => {
      console.log(`🚫 External request blocked: ${method} ${url}`);
    },
    onInternalAllowed: (url, method) => {
      console.log(`✅ Internal request allowed: ${method} ${url}`);
    },
  });

  const cameras = useCameras();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [cameraId, setCameraId] = useState<string>();
  const [isLicenseValid, setIsLicenseValid] = useState(false);
  const [isMobile] = useState(
    UAParser(navigator.userAgent).device.type === 'mobile',
  );
  useDisableZoom();

  // Log blocking stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const stats = getStats();
      if (stats.externalBlocked > 0 || stats.internalAllowed > 0 || stats.externalAllowed > 0) {
        console.log('📊 Request blocking stats:', stats);
      }
    }, 10000); // Log every 10 seconds

    return () => clearInterval(interval);
  }, [getStats]);

  const onSettingsClickedHandler = useCallback((event) => {
    const settingsBars = document.getElementById('settingsBars');
    const isSettingsButtonClicked = event.target.id === 'settingsButton';

    const isInsideSettingsClicked =
      settingsBars.contains(event.target as Node) || isSettingsButtonClicked;

    if (!isInsideSettingsClicked) {
      setIsSettingsOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('click', onSettingsClickedHandler);
    return () => {
      document.removeEventListener('click', onSettingsClickedHandler);
    };
  }, []);

  const updateLicenseStatus = useCallback((valid) => {
    setIsLicenseValid(valid);
  }, []);

  const toggleSettingsClick = useCallback(() => {
    setIsSettingsOpen(!isSettingsOpen);
  }, [isSettingsOpen]);

  const handleCloseSettings = useCallback(({ cameraId }) => {
    setCameraId(cameraId);
    setIsSettingsOpen(false);
  }, []);

  useEffect(() => {
    if (!cameras?.length) return;
    setCameraId(cameras[0].deviceId);
  }, [cameras]);

  return (
    <Container isSettingsOpen={isSettingsOpen}>
      <BiosenseSignalMonitor
        showMonitor={!(isMobile && isSettingsOpen)}
        cameraId={cameraId}
        onLicenseStatus={updateLicenseStatus}
        onSettingsClick={toggleSettingsClick}
        isSettingsOpen={isSettingsOpen}
      />
      <SettingsBars
        open={isSettingsOpen}
        onClose={handleCloseSettings}
        cameras={cameras}
        isLicenseValid={isLicenseValid}
      />
    </Container>
  );
};

export default App;
