import { WeatherWidget } from '../components/WeatherWidget/WeatherWidget';

interface WeatherAppProps {
  onEnterChat: () => void;
}

export function WeatherApp({ onEnterChat }: WeatherAppProps) {
  return <WeatherWidget onSecretEntry={onEnterChat} />;
}
