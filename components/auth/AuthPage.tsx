
import React, { useState } from 'react';
import { User } from '../../types';
import { PAKISTAN_LOCATIONS } from '../../constants';
import { auth, db } from '../../firebaseConfig';
import { signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';

type AuthStep = 'form' | 'verification_pending';

interface AuthPageProps {
  onLogin: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  onSignup: (userData: Omit<User, 'id' | 'isVerified'> & { referralCodeInput?: string }) => Promise<{ success: boolean; message: string; user?: User }>;
  onVerifyAndLogin: (userId: string) => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onLogin, onSignup, onVerifyAndLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<AuthStep>('form');
  const [isLoading, setIsLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [shopName, setShopName] = useState('');
  const [password, setPassword] = useState('');
  const [referralCodeInput, setReferralCodeInput] = useState('');
  
  // Structured Address State
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  
  const [error, setError] = useState<string>('');
  const [info, setInfo] = useState('');

  const handlePasswordReset = async () => {
      if (!email) {
          setError("Please enter your email first.");
          return;
      }
      if (!auth) return;
      try {
          await sendPasswordResetEmail(auth, email);
          setInfo(`Reset link sent to ${email}. Check your inbox.`);
      } catch (e: any) {
          setError(e.message);
      }
  };

  const handleResendEmail = async () => {
      // In a strict verification flow, the user is logged out after signup.
      // To resend, they'd typically need to log in first, but Firebase allows re-sending 
      // if we have a temporary credential or if they just signed up.
      // For this implementation, we advise users to return to login if they closed the session.
      setResending(true);
      setError('');
      try {
          // If the session is still active (just after signup)
          if (auth.currentUser) {
              await sendEmailVerification(auth.currentUser);
              setInfo("Verification email sent again. Please check your inbox!");
          } else {
              setError("Session expired. Please try to log in to trigger a new verification link.");
          }
      } catch (e: any) {
          if (e.code === 'auth/too-many-requests') {
              setError("Too many requests. Please wait a few minutes before trying again.");
          } else {
              setError(e.message);
          }
      } finally {
          setResending(false);
      }
  };

  const clearForm = () => {
    setName(''); setEmail(''); setPhone(''); setShopName(''); 
    setPassword(''); setError(''); setInfo('');
    setSelectedProvince(''); setSelectedCity(''); setManualAddress('');
    setReferralCodeInput('');
  };

  const handleModeToggle = (mode: 'login' | 'signup') => {
    setIsLogin(mode === 'login');
    setStep('form');
    clearForm();
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!email || !password) {
      setError('Email and Password are required.');
      return;
    }
    setIsLoading(true);
    const result = await onLogin(email, password);
    setIsLoading(false);
    
    if (!result.success) {
      setError(result.message);
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    
    if (!selectedProvince || !selectedCity || !manualAddress) {
        setError('Complete business address is required.');
        return;
    }
    const fullShopAddress = `${manualAddress}, ${selectedCity}, ${selectedProvince}`;

    if (!name || !email || !phone || !shopName || !password) {
      setError('Please fill in all the required fields.');
      return;
    }

    setIsLoading(true);
    const result = await onSignup({ name, email, phone, shopName, shopAddress: fullShopAddress, password, referralCodeInput });
    setIsLoading(false);

    if (result.success) {
      setStep('verification_pending');
    } else {
      setError(result.message);
    }
  };

  const LocationInputs = () => (
      <div className="space-y-3 bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
           <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Business Location</label>
           <input type="text" value="Pakistan" disabled className="w-full px-4 py-2.5 bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 text-sm font-bold" />
           <select 
              value={selectedProvince}
              onChange={(e) => { setSelectedProvince(e.target.value); setSelectedCity(''); }}
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
              required
           >
               <option value="">Select Province</option>
               {Object.keys(PAKISTAN_LOCATIONS).map(prov => <option key={prov} value={prov}>{prov}</option>)}
           </select>
           <select 
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              disabled={!selectedProvince}
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm disabled:opacity-50"
              required
           >
               <option value="">{selectedProvince ? "Select City" : "Select Province First"}</option>
               {selectedProvince && PAKISTAN_LOCATIONS[selectedProvince]?.map(city => <option key={city} value={city}>{city}</option>)}
           </select>
           <input
              type="text"
              value={manualAddress}
              onChange={(e) => setManualAddress(e.target.value)}
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm"
              placeholder="Shop #, Street, Area / Bazaar"
              required
           />
      </div>
  );

  const renderForm = () => (
    <div className="space-y-6">
      <form onSubmit={isLogin ? handleLoginSubmit : handleSignupSubmit} className="space-y-5">
        {!isLogin && (
          <>
            <InputField id="name" label="Full Name" type="text" value={name} onChange={setName} required />
            <InputField id="phone" label="Phone Number" type="tel" value={phone} onChange={setPhone} required />
            <InputField id="shopName" label="Business / Shop Name" type="text" value={shopName} onChange={setShopName} required />
            <LocationInputs />
          </>
        )}
        <InputField id="email" label="Email Address" type="email" value={email} onChange={setEmail} required />
        <InputField id="password" label="Password" type="password" value={password} onChange={setPassword} required />
        
        {!isLogin && (
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                <label className="block text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-2">Referral Code (Optional)</label>
                <input
                  type="text"
                  value={referralCodeInput}
                  onChange={(e) => setReferralCodeInput(e.target.value)}
                  placeholder="e.g. FRIEND-1234"
                  className="block w-full px-4 py-2 bg-white dark:bg-gray-800 border border-indigo-200 dark:border-indigo-700 rounded-lg outline-none text-sm font-mono"
                />
            </div>
        )}

        {isLogin && (
            <div className="flex justify-end">
                <button type="button" onClick={handlePasswordReset} className="text-xs text-primary dark:text-blue-400 hover:underline font-bold">Forgot Password?</button>
            </div>
        )}

        <button type="submit" className="w-full py-4 px-4 bg-primary text-white font-bold rounded-2xl shadow-xl hover:brightness-110 active:scale-[0.98] transition-all flex justify-center disabled:opacity-50" disabled={isLoading}>
          {isLoading ? <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span> : (isLogin ? 'Sign In' : 'Create Account')}
        </button>
      </form>
    </div>
  );

  const renderVerificationPending = () => (
    <div className="text-center py-6 animate-fade-in">
        <div className="w-24 h-24 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
        </div>
        
        <h2 className="text-2xl font-black text-gray-900 dark:text-white mb-4">Verify Your Email</h2>
        
        <div className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-800 text-left space-y-4 mb-8">
            <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                A verification link has been sent to your <span className="font-bold">email address</span>.
            </p>
            <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                Please check your <span className="font-bold">Inbox</span>. 
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 italic bg-white/50 dark:bg-black/20 p-3 rounded-lg border border-blue-200/50">
                "If you don't see the email, kindly check your <span className="font-bold underline">Spam</span> or <span className="font-bold underline">Trash</span> folder."
            </p>
        </div>

        <div className="space-y-4">
            <button 
                onClick={handleResendEmail}
                disabled={resending}
                className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-lg hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
                {resending ? <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span> : 'Resend Verification Email'}
            </button>
            
            <button 
                onClick={() => handleModeToggle('login')}
                className="w-full py-3 text-gray-500 font-bold hover:text-primary transition-colors text-sm"
            >
                &larr; Back to Login
            </button>
        </div>
    </div>
  );

  return (
    <div className="max-w-md mx-auto mt-4 px-2">
      <div className="bg-white dark:bg-dark-surface rounded-3xl shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
        {step === 'form' && (
          <div className="flex bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
            <button onClick={() => handleModeToggle('login')} className={`flex-1 p-4 text-center font-black text-xs tracking-widest transition-all ${isLogin ? 'bg-white dark:bg-dark-surface text-primary border-b-4 border-primary' : 'text-gray-400'}`}>LOG IN</button>
            <button onClick={() => handleModeToggle('signup')} className={`flex-1 p-4 text-center font-black text-xs tracking-widest transition-all ${!isLogin ? 'bg-white dark:bg-dark-surface text-primary border-b-4 border-primary' : 'text-gray-400'}`}>REGISTER</button>
          </div>
        )}
        <div className="p-8">
            {step === 'form' && (
                <div className="mb-8 text-center">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-white">{isLogin ? 'Welcome Back' : 'Join RizqDaan'}</h2>
                    <p className="text-sm text-gray-500 mt-2">{isLogin ? 'Manage your ads and earnings.' : 'Start your digital shop in minutes.'}</p>
                </div>
            )}
            
            {error && (
                <div className="bg-red-50 text-red-600 border border-red-200 p-4 rounded-2xl text-xs font-bold leading-relaxed mb-6 animate-pulse shadow-sm flex items-start gap-3">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    {error}
                </div>
            )}
            
            {info && (
                <div className="bg-blue-50 text-blue-600 border border-blue-200 p-4 rounded-2xl text-xs font-bold mb-6 shadow-sm flex items-center gap-3">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {info}
                </div>
            )}
            
            {step === 'form' ? renderForm() : renderVerificationPending()}
        </div>
      </div>
      
      <div className="mt-8 text-center">
          <p className="text-xs text-gray-500 font-medium">By continuing, you agree to our <span className="text-primary underline">Terms of Service</span> and <span className="text-primary underline">Privacy Policy</span>.</p>
      </div>
    </div>
  );
};

const InputField = ({ id, label, type, value, onChange, required=false, disabled=false }: { id: string, label: string, type: string, value: string, onChange?: (val: string) => void, required?: boolean, disabled?: boolean }) => (
  <div className="space-y-1.5">
    <label htmlFor={id} className="block text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest ml-1">{label}</label>
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
      className="block w-full px-4 py-3.5 bg-gray-50 dark:bg-gray-900 border-2 border-transparent focus:border-primary/30 rounded-2xl shadow-inner focus:outline-none disabled:bg-gray-100 dark:disabled:bg-gray-800 dark:text-white transition-all text-sm font-medium"
      required={required}
      disabled={disabled}
    />
  </div>
);

export default AuthPage;
