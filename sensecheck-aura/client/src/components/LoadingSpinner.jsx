const LoadingSpinner = ({ message = 'Loading...' }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <div className="loading-spinner mb-4"></div>
      <p className="text-gray-300">{message}</p>
    </div>
  );
};

export default LoadingSpinner;

