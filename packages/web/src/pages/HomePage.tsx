import { Link } from 'react-router-dom';
import { Sparkles, Globe, Shield, Leaf, Clock, Award } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="bg-gradient-to-b from-luxury-50 to-white">
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-luxury-900 mb-6">
            Your World, <span className="text-gold-600">Anticipated</span>
          </h1>
          <p className="text-xl text-luxury-600 mb-8 max-w-3xl mx-auto">
            AI-Powered Luxury Travel Planning for Ultra-High-Net-Worth Clients
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register" className="btn-gold text-lg px-8 py-3">
              <Sparkles className="inline-block mr-2 h-5 w-5" />
              Start Your Journey
            </Link>
            <Link to="/login" className="btn-secondary text-lg px-8 py-3">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <h2 className="text-4xl font-bold text-center text-luxury-900 mb-12">
          Elevate Your Travel Experience
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Sparkles className="h-8 w-8 text-gold-500" />}
            title="AI-Powered Planning"
            description="Our AI, trained with 7+ years of luxury travel expertise, crafts ultra-bespoke experiences in under 60 seconds."
          />
          <FeatureCard
            icon={<Globe className="h-8 w-8 text-gold-500" />}
            title="Off-Market Access"
            description="Exclusive access to vetted off-market deals, private aviation, luxury villas, and unique experiences."
          />
          <FeatureCard
            icon={<Shield className="h-8 w-8 text-gold-500" />}
            title="White-Glove Service"
            description="Concierge-level support with complete discretion, security, and cultural sensitivity."
          />
          <FeatureCard
            icon={<Leaf className="h-8 w-8 text-gold-500" />}
            title="Sustainability Focus"
            description="Real-time carbon tracking and offset options for environmentally conscious luxury travel."
          />
          <FeatureCard
            icon={<Clock className="h-8 w-8 text-gold-500" />}
            title="Live Updates"
            description="Real-time itinerary updates, flight tracking, and proactive disruption management."
          />
          <FeatureCard
            icon={<Award className="h-8 w-8 text-gold-500" />}
            title="Vetted Vendors"
            description="Only the finest luxury providers with verified credentials, insurance, and safety badges."
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-luxury-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Experience Luxury Travel Reimagined?
          </h2>
          <p className="text-luxury-200 mb-8">
            Join the exclusive community of UHNW travelers who trust LuxAI Designer
            for their most memorable journeys.
          </p>
          <Link to="/register" className="btn-gold text-lg px-8 py-3 inline-block">
            Get Started Today
          </Link>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="card hover:shadow-lg transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-luxury-900 mb-2">{title}</h3>
      <p className="text-luxury-600">{description}</p>
    </div>
  );
}
