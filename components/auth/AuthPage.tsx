
import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { PAKISTAN_LOCATIONS } from '../../constants';
import { auth, googleProvider, db } from '../../firebaseConfig';
import { signInWithPopup, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

type AuthStep = 'form' | 'otp' | 'google_details';

interface AuthPageProps {
  onLogin: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  onSignup: (userData: Omit<User, 'id' | 'isVerified'> & { referralCodeInput?: string }) => Promise<{ success: boolean; message: string; user?: User }>;
  onVerifyAndLogin: (userId: string) => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onLogin, onSignup, onVerifyAndLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<AuthStep>('form');
  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [googleData, setGoogleData] = useState<{name: string, email: string, googleId: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [shopName, setShopName] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [referralCodeInput, setReferralCodeInput] = useState('');
  
  // Structured Address State
  const [selectedProvince, setSelectedProvince] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [manualAddress, setManualAddress] = useState('');
  
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handleGoogleAuth = async () => {
      if (!auth) return;
      setError('');
      setIsLoading(true);
      try {
          const result = await signInWithPopup(auth, googleProvider);
          const user = result.user;
          
          if(db) {
              const userDoc = await getDoc(doc(db, "users", user.uid));
              if (!userDoc.exists()) {
                  setGoogleData({
                      name: user.displayName || '',
                      email: user.email || '',
                      googleId: user.uid
                  });
                  setInfo('Welcome! One last step: Complete your vendor profile.');
                  setStep('google_details');
              } else {
                  setInfo('Authenticating...');
              }
          }
      } catch (e: any) {
          console.error("Auth Error Trace:", e);
          
          if (e.message.includes('unauthorized-domain')) {
              const currentHost = window.location.hostname;
              if (!currentHost || currentHost === "") {
                  setError("Security Block: Firebase cannot detect this preview domain. Please add 'aistudio.google.com' and 'aistudiocdn.com' to 'Authorized Domains' in Firebase Console.");
              } else {
                  setError(`Domain "${currentHost}" is not authorized in Firebase. In production, add your official website domain to the whitelist.`);
              }
          } else if (e.message.includes('popup-closed-by-user')) {
              setError("Sign-in popup was closed. Please try again.");
          } else {
              setError(e.message || "An unknown authentication error occurred.");
          }
      } finally {
          setIsLoading(false);
      }
  };

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
      if (!auth.currentUser) return;
      setResending(true);
      try {
          await sendEmailVerification(auth.currentUser);
          setInfo("Verification email sent again. Please check your inbox/spam.");
      } catch (e: any) {
          setError("Too many requests. Please wait a moment.");
      } finally {
          setResending(false);
      }
  };

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    // For demo/testing purpose, we use a bypass code. 
    // In production, user clicks the link in email which updates their status.
    if (otp === '123456' && pendingUser) {
      onVerifyAndLogin(pendingUser.id);
    } else {
      setError('Incorrect Code. (Check Gmail for the verification link or use test code: 123456)');
    }
  };

  const clearForm = () => {
    setName(''); setEmail(''); setPhone(''); setShopName(''); 
    setPassword(''); setOtp(''); setError(''); setInfo('');
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
    if (!email || !password) {
      setError('Email and Password are required.');
      return;
    }
    setIsLoading(true);
    const result = await onLogin(email, password);
    setIsLoading(false);
    
    if (!result.success) {
      setError("Login failed. Please check your credentials.");
    }
  };

  const handleSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!selectedProvince || !selectedCity || !manualAddress) {
        setError('Please provide a complete shop address.');
        return;
    }
    const fullShopAddress = `${manualAddress}, ${selectedCity}, ${selectedProvince}`;

    if (!name || !email || !phone || !shopName || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    setIsLoading(true);
    const result = await onSignup({ name, email, phone, shopName, shopAddress: fullShopAddress, password, referralCodeInput });
    setIsLoading(false);

    if (result.success && result.user) {
      setPendingUser(result.user);
      setStep('otp');
    } else {
      setError(result.message);
    }
  };
  
  const handleGoogleDetailsSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      if (!selectedProvince || !selectedCity || !manualAddress) {
          setError('Shop address is mandatory.');
          return;
      }
      const fullShopAddress = `${manualAddress}, ${selectedCity}, ${selectedProvince}`;
      if (!googleData || !phone || !shopName) {
          setError('Please fill in business details.');
          return;
      }
      setIsLoading(true);
      const result = await onSignup({ 
          ...googleData, 
          phone, 
          shopName, 
          shopAddress: fullShopAddress, 
          password: `google_${googleData.googleId}`, 
          referralCodeInput 
      });
      setIsLoading(false);
      if (result.success && result.user) {
          setPendingUser(result.user);
          setStep('otp');
      } else {
          setError(result.message);
      }
  }
  
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

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true"><div className="w-full border-t border-gray-200 dark:border-gray-700" /></div>
        <div className="relative flex justify-center"><span className="px-4 bg-white dark:bg-dark-surface text-[10px] font-black text-gray-400 uppercase tracking-widest">Social Login</span></div>
      </div>

      <button 
        type="button" 
        onClick={handleGoogleAuth} 
        disabled={isLoading}
        className="w-full py-3.5 px-4 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-bold rounded-2xl shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
      >
        <svg className="w-5 h-5" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.222 0-9.582-3.344-11.227-7.915l-6.573 4.818C9.656 39.663 16.318 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.574l6.19 5.238C39.999 35.596 44 30.165 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>
        Continue with Google
      </button>
    </div>
  );

  const renderOtpForm = () => (
    <div className="text-center py-4 animate-fade-in">
        <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        </div>
        <h3 className="text-xl font-black text-gray-800 dark:text-white">Verify Your Email</h3>
        
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-2xl">
            <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed text-left">
                A verification link has been sent to your <span className="font-bold">Gmail</span>. 
                <br /><br />
                If email is not visible in your inbox please check <span className="font-bold underline">spam</span> or <span className="font-bold underline">trash</span> folder in your gmail.
            </p>
        </div>

        <form onSubmit={handleOtpSubmit} className="space-y-5 mt-8 text-left">
            <InputField 
                id="otp" 
                label="Enter test code (123456)" 
                type="text" 
                value={otp} 
                onChange={setOtp} 
                required 
            />
            <button type="submit" className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-xl hover:brightness-110 active:scale-95 transition-all">Verify & Sign In</button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500 mb-3">Didn't receive the email?</p>
            <button 
                onClick={handleResendEmail} 
                disabled={resending}
                className="text-sm text-primary font-bold hover:underline disabled:opacity-50"
            >
                {resending ? 'Sending...' : 'Resend Verification Link'}
            </button>
        </div>
    </div>
  );
  
  const renderGoogleDetailsForm = () => (
      <div className="animate-fade-in">
        <h3 className="text-xl font-black text-gray-800 dark:text-white text-center">Business Profile</h3>
        <p className="text-sm text-gray-500 mb-8 text-center">Add your shop details to start selling.</p>
        <form onSubmit={handleGoogleDetailsSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <InputField id="name" label="Legal Name" type="text" value={googleData?.name || ''} disabled />
                <InputField id="email" label="Contact Email" type="email" value={googleData?.email || ''} disabled />
            </div>
            <InputField id="phone" label="Mobile Number" type="tel" value={phone} onChange={setPhone} required />
            <InputField id="shopName" label="Business / Shop Name" type="text" value={shopName} onChange={setShopName} required />
            <LocationInputs />
            <button type="submit" className="w-full py-4 bg-primary text-white font-bold rounded-2xl shadow-xl hover:brightness-110 transition-all mt-4" disabled={isLoading}>
                {isLoading ? <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span> : 'Complete Registration'}
            </button>
        </form>
      </div>
  );

  const renderContent = () => {
    switch(step) {
      case 'form': return renderForm();
      case 'otp': return renderOtpForm();
      case 'google_details': return renderGoogleDetailsForm();
      default: return renderForm();
    }
  }

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
            {error && <div className="bg-red-50 text-red-600 border border-red-200 p-4 rounded-2xl text-xs font-bold leading-relaxed mb-6 animate-pulse shadow-sm">{error}</div>}
            {info && <div className="bg-blue-50 text-blue-600 border border-blue-200 p-4 rounded-2xl text-xs font-bold mb-6 shadow-sm">{info}</div>}
            {renderContent()}
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
