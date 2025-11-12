import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';

interface SustainabilityReport {
  itineraryId: string;
  totalEmissions: number;
  emissionsByCategory: {
    flights: number;
    accommodations: number;
    groundTransportation: number;
    activities: number;
  };
  breakdown: {
    flights: Array<{
      route: string;
      distance: number;
      emissions: number;
      aircraftType: string;
    }>;
    accommodations: Array<{
      property: string;
      nights: number;
      emissions: number;
    }>;
    groundTransport: Array<{
      type: string;
      distance: number;
      emissions: number;
    }>;
  };
  offsetOptions: Array<{
    provider: string;
    pricePerTon: number;
    totalCost: number;
    certifications: string[];
  }>;
  recommendations: string[];
}

export const SustainabilityReportPage: React.FC = () => {
  const { itineraryId } = useParams<{ itineraryId: string }>();
  const [report, setReport] = useState<SustainabilityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [selectedOffset, setSelectedOffset] = useState<number | null>(null);

  useEffect(() => {
    if (itineraryId) {
      loadReport();
    }
  }, [itineraryId]);

  const loadReport = async () => {
    try {
      const response = await api.sustainability.getReport(itineraryId!);
      setReport(response.data);
    } catch (error) {
      console.error('Failed to load sustainability report:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePurchaseOffset = async () => {
    if (!report || selectedOffset === null) return;

    setPurchasing(true);
    try {
      const offset = report.offsetOptions[selectedOffset];
      await api.sustainability.purchaseOffset({
        itineraryId: report.itineraryId,
        offsetAmount: report.totalEmissions,
      });
      alert('Carbon offset purchased successfully!');
    } catch (error) {
      console.error('Failed to purchase offset:', error);
      alert('Failed to purchase carbon offset. Please try again.');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading sustainability report...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold mb-4">Report Not Found</h2>
          <p className="text-gray-600">Unable to load sustainability report for this itinerary.</p>
        </div>
      </div>
    );
  }

  const getEmissionLevel = (emissions: number) => {
    if (emissions < 1000) return { label: 'Low', color: 'green' };
    if (emissions < 5000) return { label: 'Medium', color: 'yellow' };
    return { label: 'High', color: 'red' };
  };

  const emissionLevel = getEmissionLevel(report.totalEmissions);

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Sustainability Report</h1>
              <p className="text-gray-600">Carbon footprint analysis using ICAO methodology</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500 mb-1">Total Carbon Emissions</p>
              <p className="text-4xl font-bold text-green-600">
                {report.totalEmissions.toLocaleString()} kg
              </p>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium bg-${emissionLevel.color}-100 text-${emissionLevel.color}-800`}>
                {emissionLevel.label} Impact
              </span>
            </div>
          </div>
        </div>

        {/* Emissions Breakdown */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">Emissions by Category</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-3 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-2xl">✈️</span>
              </div>
              <p className="text-sm text-gray-500 mb-1">Flights</p>
              <p className="text-xl font-bold text-blue-600">
                {report.emissionsByCategory.flights.toLocaleString()} kg
              </p>
              <p className="text-xs text-gray-500">
                {((report.emissionsByCategory.flights / report.totalEmissions) * 100).toFixed(1)}%
              </p>
            </div>

            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-3 rounded-full bg-purple-100 flex items-center justify-center">
                <span className="text-2xl">🏨</span>
              </div>
              <p className="text-sm text-gray-500 mb-1">Accommodations</p>
              <p className="text-xl font-bold text-purple-600">
                {report.emissionsByCategory.accommodations.toLocaleString()} kg
              </p>
              <p className="text-xs text-gray-500">
                {((report.emissionsByCategory.accommodations / report.totalEmissions) * 100).toFixed(1)}%
              </p>
            </div>

            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-3 rounded-full bg-orange-100 flex items-center justify-center">
                <span className="text-2xl">🚗</span>
              </div>
              <p className="text-sm text-gray-500 mb-1">Ground Transport</p>
              <p className="text-xl font-bold text-orange-600">
                {report.emissionsByCategory.groundTransportation.toLocaleString()} kg
              </p>
              <p className="text-xs text-gray-500">
                {((report.emissionsByCategory.groundTransportation / report.totalEmissions) * 100).toFixed(1)}%
              </p>
            </div>

            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-3 rounded-full bg-green-100 flex items-center justify-center">
                <span className="text-2xl">🎯</span>
              </div>
              <p className="text-sm text-gray-500 mb-1">Activities</p>
              <p className="text-xl font-bold text-green-600">
                {report.emissionsByCategory.activities.toLocaleString()} kg
              </p>
              <p className="text-xs text-gray-500">
                {((report.emissionsByCategory.activities / report.totalEmissions) * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          {/* Detailed Breakdown */}
          <div className="space-y-6">
            {/* Flight Details */}
            {report.breakdown.flights.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Flight Details</h3>
                <div className="space-y-2">
                  {report.breakdown.flights.map((flight, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{flight.route}</p>
                        <p className="text-sm text-gray-600">
                          {flight.aircraftType} • {flight.distance.toLocaleString()} nm
                        </p>
                      </div>
                      <p className="font-semibold text-blue-600">
                        {flight.emissions.toLocaleString()} kg CO₂
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Accommodation Details */}
            {report.breakdown.accommodations.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Accommodation Details</h3>
                <div className="space-y-2">
                  {report.breakdown.accommodations.map((accommodation, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{accommodation.property}</p>
                        <p className="text-sm text-gray-600">{accommodation.nights} nights</p>
                      </div>
                      <p className="font-semibold text-purple-600">
                        {accommodation.emissions.toLocaleString()} kg CO₂
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ground Transport Details */}
            {report.breakdown.groundTransport.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Ground Transportation Details</h3>
                <div className="space-y-2">
                  {report.breakdown.groundTransport.map((transport, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{transport.type}</p>
                        <p className="text-sm text-gray-600">{transport.distance.toLocaleString()} km</p>
                      </div>
                      <p className="font-semibold text-orange-600">
                        {transport.emissions.toLocaleString()} kg CO₂
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Carbon Offset Options */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">Carbon Offset Options</h2>

          <div className="grid md:grid-cols-3 gap-6">
            {report.offsetOptions.map((option, index) => (
              <div
                key={index}
                className={`border-2 rounded-lg p-6 cursor-pointer transition-all ${
                  selectedOffset === index
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-green-300'
                }`}
                onClick={() => setSelectedOffset(index)}
              >
                <h3 className="text-lg font-semibold mb-2">{option.provider}</h3>
                <p className="text-3xl font-bold text-green-600 mb-3">
                  ${option.totalCost.toFixed(2)}
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  ${option.pricePerTon}/ton • {(report.totalEmissions / 1000).toFixed(2)} tons
                </p>
                <div className="space-y-1">
                  {option.certifications.map((cert, certIndex) => (
                    <p key={certIndex} className="text-xs text-gray-500">✓ {cert}</p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handlePurchaseOffset}
            disabled={selectedOffset === null || purchasing}
            className="mt-6 w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {purchasing ? 'Processing...' : 'Purchase Carbon Offset'}
          </button>
        </div>

        {/* Recommendations */}
        {report.recommendations.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold mb-6">Sustainability Recommendations</h2>
            <ul className="space-y-3">
              {report.recommendations.map((recommendation, index) => (
                <li key={index} className="flex items-start">
                  <span className="text-green-600 mr-3 mt-1">✓</span>
                  <span className="text-gray-700">{recommendation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ICAO Methodology Note */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">About Our Calculations</h3>
          <p className="text-sm text-blue-800">
            Our carbon emissions calculations follow the ICAO (International Civil Aviation Organization) methodology,
            including radiative forcing multiplier of 1.9 for flight emissions. Accommodation and ground transportation
            estimates are based on industry-standard emission factors.
          </p>
        </div>
      </div>
    </div>
  );
};
