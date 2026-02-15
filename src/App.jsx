import { useState, useEffect } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { auth, googleProvider, storage } from "./firebase";
import { signInWithPopup } from "firebase/auth";
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { supabase } from './supabaseClient'; // Import the client you just made
import emailjs from '@emailjs/browser'; 
export default function App() {
  // ===== User/Auth States =====
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState(""); 
  const [username, setUsername] = useState(""); 
  const [loginId, setLoginId] = useState(""); 
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState(""); 
  const [email, setEmail] = useState("");
  const [signupRole, setSignupRole] = useState("student");
  const [signupDept, setSignupDept] = useState("CSE"); 
  const [showSignup, setShowSignup] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  
  // ===== OTP Verification States =====
  const [verificationStep, setVerificationStep] = useState(""); 
  const [otpInput, setOtpInput] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false); 

  const [captcha, setCaptcha] = useState("");
  const [captchaValue, setCaptchaValue] = useState("");

  // ===== Notice & UI States =====
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [category, setCategory] = useState("Announcement");
  const [priority, setPriority] = useState("normal");
  const [dept, setDept] = useState("All");
  const [eventDate, setEventDate] = useState(""); // NEW: For Countdown
  const [attachment, setAttachment] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [showSavedOnly, setShowSavedOnly] = useState(false); 
  const [showNotifications, setShowNotifications] = useState(false); 
  
  // WhatsApp-style Popup State
  const [popupMsg, setPopupMsg] = useState(null); 
  const [time, setTime] = useState(new Date());

  // ===== Local Storage =====
  const [users, setUsers] = useState(() => {
    const saved = localStorage.getItem("users");
    return saved ? JSON.parse(saved) : [];
  });

  const [notices, setNotices] = useState(() => {
    const saved = localStorage.getItem("notices");
    if (saved) return JSON.parse(saved);
    return [];
  });

  // ===== Live Clock (Also drives Countdown Refresh) =====
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ===== Dynamic CAPTCHA Refresh =====
  useEffect(() => {
    setCaptchaValue(Math.random().toString(36).substring(2, 8));
  }, [showSignup, forgotPassword, username, email, password, confirmPassword, signupRole, signupDept, loginId]);

  // ===== Save to localStorage =====
  useEffect(() => {
    localStorage.setItem("users", JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    localStorage.setItem("notices", JSON.stringify(notices));
  }, [notices]);

  // ===== Countdown Logic Function =====
  const getCountdown = (targetDate) => {
    if (!targetDate) return null;
    const now = new Date().getTime();
    const target = new Date(targetDate).getTime();
    const diff = target - now;

    if (diff <= 0) return "EVENT STARTED";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  // ===== Permissions Check =====
  const hasPostAuthority = ["admin", "staff", "hod"].includes(role);

  // ===== Notification Logic =====
  const currentUserData = users.find(u => u.username === username) || { dept: "All", readNotices: [] };
  const readNotices = currentUserData.readNotices || [];
  
  const myUnreadNotices = notices.filter(n => 
    (n.dept === "All" || n.dept === currentUserData.dept) && 
    !readNotices.includes(n.id)
  );

  const triggerPopup = (notice) => {
    setPopupMsg(notice);
    try {
      const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
      audio.volume = 0.5;
      audio.play();
    } catch (e) { }
    setTimeout(() => setPopupMsg(null), 5000); 
  };

  const markAsRead = (noticeId) => {
    setUsers(users.map(u => u.username === username ? { ...u, readNotices: [...(u.readNotices || []), noticeId] } : u));
  };

  const markAllAsRead = () => {
    const allMyNoticeIds = notices.filter(n => n.dept === "All" || n.dept === currentUserData.dept).map(n => n.id);
    setUsers(users.map(u => u.username === username ? { ...u, readNotices: [...new Set([...(u.readNotices || []), ...allMyNoticeIds])] } : u));
  };

  // ===== Password Validator =====
  const validatePassword = (pass) => {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
    return regex.test(pass);
  };
  const passwordErrorMsg = "Password must be at least 8 chars long: 1 uppercase, 1 lowercase, 1 number, and 1 special char.";

  // ===== Authentication Handlers =====
  const login = () => {
    if (!loginId || !password) return alert("Fill credentials");
    if (captcha !== captchaValue) return alert("Invalid CAPTCHA");

    if ((loginId === "admin" || loginId === "admin@tpgit.edu.in") && password === "Admin123") {
      setRole("admin");
      setUsername("Admin");
      setLoggedIn(true);
      return;
    }

    const user = users.find((u) => (u.username === loginId || u.email === loginId) && u.password === password);
    if (user) {
      setRole(user.role || "student");
      setUsername(user.username);
      setLoggedIn(true);
    } else {
      alert("Wrong login credentials");
    }
  };

  const requestSignupOtp = () => {
    if (!username || !password || !confirmPassword || !email) return alert("Fill all fields");
    if (password !== confirmPassword) return alert("Passwords do not match!");
    if (!validatePassword(password)) return alert(passwordErrorMsg);
    if (captcha !== captchaValue) return alert("Invalid CAPTCHA");
    if (users.some((u) => u.username === username)) return alert("Username already taken");
    if (users.some((u) => u.email === email)) return alert("Email already registered");

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(otp);
    setIsSendingEmail(true);

    emailjs.send(
      'service_9j1amze',
      'template_f93qayi',
      { to_email: email, to_name: username, otp: otp },
      { publicKey: 'UjYzVPQms-aRIezx7' }
    ).then(() => {
      alert(`OTP successfully sent to ${email}`);
      setVerificationStep("signup");
      setIsSendingEmail(false);
    }).catch((error) => {
      alert("EmailJS Failed: " + (error.text || error.message || "Unknown error"));
      setIsSendingEmail(false);
    });
  };

  const verifySignupAndCreate = () => {
    if (otpInput !== generatedOtp) return alert("Invalid OTP! Try again.");
    const newUser = { username, password, email, role: signupRole, dept: signupDept, readNotices: [] };
    setUsers([...users, newUser]);
    alert("Email verified! Account created successfully.");
    setVerificationStep(""); setShowSignup(false); resetForms();
  };

  const requestResetOtp = () => {
    if (!email) return alert("Enter your registered email");
    const user = users.find((u) => u.email === email);
    if (!user) return alert("No account found with this email");

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(otp);
    setIsSendingEmail(true);

    emailjs.send(
      'service_9j1amze',
      'template_f93qayi',
      { to_email: email, to_name: user.username, otp: otp },
      { publicKey: 'UjYzVPQms-aRIezx7' }
    ).then(() => {
      alert(`Password reset OTP successfully sent to ${email}`);
      setVerificationStep("reset");
      setIsSendingEmail(false);
    }).catch((error) => {
      alert("EmailJS Failed: " + (error.text || error.message || "Unknown error"));
      setIsSendingEmail(false);
    });
  };

  const verifyResetAndUpdatePassword = () => {
    if (otpInput !== generatedOtp) return alert("Invalid OTP! Try again.");
    if (!password || !confirmPassword) return alert("Fill new password fields");
    if (password !== confirmPassword) return alert("Passwords do not match!");
    if (!validatePassword(password)) return alert(passwordErrorMsg);

    setUsers(users.map(u => u.email === email ? { ...u, password: password } : u));
    alert("Password updated successfully! You can now login.");
    setVerificationStep(""); setForgotPassword(false); resetForms();
  };

  const resetForms = () => {
    setUsername(""); setLoginId(""); setPassword(""); setConfirmPassword(""); 
    setEmail(""); setOtpInput(""); setCaptcha(""); setEventDate("");
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const gUser = result.user;
      let localUser = users.find((u) => u.email === gUser.email);
      if (!localUser) {
        localUser = { username: gUser.displayName.split(" ")[0], email: gUser.email, password: "", role: "student", dept: "All", readNotices: [], google: true };
        setUsers([...users, localUser]);
      }
      setUsername(localUser.username);
      setRole(localUser.role);
      setLoggedIn(true);
    } catch (err) {
      alert("Google Sign-In Failed");
    }
  };

const addNotice = async () => {
  if (!title || !desc) return alert("Fill all fields");

  const isEditing = editingId !== null;
  const tempId = isEditing ? editingId : Date.now();
  const currentFile = attachment;
  const isNewFile = currentFile instanceof File;

  const existingNotice = notices.find(n => n.id === editingId);

  const newNoticeData = {
    id: tempId,
    title,
    desc,
    category,
    priority,
    dept,
    eventDate: category === "Event" ? eventDate : null,
    // Ensure this specific line is correct in your object:
    attachment: isNewFile ? null : (existingNotice?.attachment || null),  
    isUploadingFile: isNewFile,
    pinned: existingNotice ? existingNotice.pinned : false, // Maintain pin status
    date: isEditing ? existingNotice.date : new Date().toLocaleString(),
    likes: existingNotice ? existingNotice.likes : [],
    bookmarks: existingNotice ? existingNotice.bookmarks : []
  };

  setNotices((prev) => 
    isEditing 
      ? prev.map((n) => (n.id === editingId ? { ...n, ...newNoticeData } : n)) 
      : [newNoticeData, ...prev]
  );

  if (!isEditing) triggerPopup(newNoticeData);
  
  // --- CORRECTED RESET LOGIC ---
  setTitle("");
  setDesc("");
  setAttachment(null);
  setEditingId(null);  // <--- ADD THIS: Resets from "Edit Mode" to "Post Mode"
  setEventDate("");
  // -----------------------------

  if (isNewFile) {
    try {
      const fileExt = currentFile.name.split('.').pop();
      const fileName = `${tempId}.${fileExt}`;
      const { error } = await supabase.storage.from('attachments').upload(fileName, currentFile, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('attachments').getPublicUrl(fileName);
      setNotices(prev => prev.map(n => n.id === tempId ? { ...n, attachment: data.publicUrl, isUploadingFile: false } : n));
    } catch (err) {
      setNotices(prev => prev.map(n => n.id === tempId ? { ...n, isUploadingFile: false } : n));
    }
  }
};
const deleteNotice = async (id) => {
  if (window.confirm("Are you sure you want to delete this notice?")) {
    const noticeToDelete = notices.find(n => n.id === id);
    
    // Cleanup: Delete from Supabase storage if it has a file
    if (noticeToDelete?.attachment) {
      const fileName = noticeToDelete.attachment.split('/').pop();
      await supabase.storage.from('attachments').remove([fileName]);
    }

    setNotices((prev) => prev.filter((n) => n.id !== id));
  }
};
  const toggleBookmark = (id) => {
    setNotices(notices.map(n => {
      if (n.id === id) {
        const newBookmarks = n.bookmarks?.includes(username) ? n.bookmarks.filter(u => u !== username) : [...(n.bookmarks || []), username];            
        return { ...n, bookmarks: newBookmarks };
      }
      return n;
    }));
  };
  const togglePin = (id) => {
  setNotices(prev => prev.map(n => 
    n.id === id ? { ...n, pinned: !n.pinned } : n
  ));
};
  const onDragEnd = (result) => {
    if (!result.destination || !hasPostAuthority) return; 
    const items = Array.from(notices);
    const [reordered] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reordered);
    setNotices(items);
  };

  // 1. Define the map FIRST
const priorityMap = { urgent: 2, important: 1, normal: 0 };

// 2. Use it in the sort logic
const sortedNotices = [...notices]
  .filter((n) => (filterCategory === "All" || n.category === filterCategory))
  .filter((n) => (search === "" || n.title.toLowerCase().includes(search.toLowerCase())))
  .filter((n) => (showSavedOnly ? n.bookmarks?.includes(username) : true)) 
  .sort((a, b) => {
    // Priority 1: Pinned notices always stay at the top
    if (b.pinned !== a.pinned) return b.pinned ? 1 : -1;

    // Priority 2: High priority (Urgent > Important > Normal)
    if (priorityMap[b.priority] !== priorityMap[a.priority]) {
      return priorityMap[b.priority] - priorityMap[a.priority];
    }

    // Priority 3: Newest notices first (Date)
    return new Date(b.date) - new Date(a.date);
  });

  // ===== UI RENDERS: LOGIN/AUTH =====
  if (!loggedIn) {
    return (
      <div className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-br from-blue-600 to-purple-700 p-4">
        <div className="text-center mb-6 flex flex-col items-center">
          <img src="/tpgit_logo.png" alt="TPGIT Logo" className="w-24 h-24 mb-4 drop-shadow-lg bg-white rounded-full p-2" />
          <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow-md px-4">Thanthai Periyar Government Institute of Technology</h1>
          <p className="text-blue-200 mt-2 text-lg">Digital Notice Board Gateway</p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md text-center max-h-[80vh] overflow-y-auto">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">
            {verificationStep === "signup" ? "Verify Email" : verificationStep === "reset" ? "Reset Password" : showSignup ? "Create Account" : forgotPassword ? "Forgot Password" : "Login"}
          </h2>

          {verificationStep === "signup" && (
            <>
              <p className="text-sm text-gray-600 mb-4">An OTP has been sent to <b>{email}</b></p>
              <input placeholder="Enter 6-digit OTP" className="w-full p-3 mb-4 border border-gray-300 rounded text-black text-center text-xl tracking-widest font-bold" value={otpInput} onChange={(e) => setOtpInput(e.target.value)} />
              <button onClick={verifySignupAndCreate} className="w-full bg-green-600 text-white py-3 rounded mb-2 font-bold hover:bg-green-700 transition">Verify & Create Account</button>
              <p className="text-blue-600 cursor-pointer font-medium mt-2" onClick={() => {setVerificationStep(""); setIsSendingEmail(false);}}>Cancel</p>
            </>
          )}

          {verificationStep === "reset" && (
            <>
              <p className="text-sm text-gray-600 mb-4">An OTP has been sent to <b>{email}</b></p>
              <input placeholder="Enter OTP" className="w-full p-3 mb-3 border border-gray-300 rounded text-black text-center tracking-widest font-bold" value={otpInput} onChange={(e) => setOtpInput(e.target.value)} />
              <input type="password" placeholder="New Password" className="w-full p-3 mb-3 border border-gray-300 rounded text-black" onChange={(e) => setPassword(e.target.value)} />
              <input type="password" placeholder="Confirm New Password" className="w-full p-3 mb-3 border border-gray-300 rounded text-black" onChange={(e) => setConfirmPassword(e.target.value)} />
              <div className="text-xs text-gray-500 text-left mb-3 px-1">{passwordErrorMsg}</div>
              <button onClick={verifyResetAndUpdatePassword} className="w-full bg-green-600 text-white py-3 rounded mb-2 font-bold hover:bg-green-700 transition">Update Password</button>
              <p className="text-blue-600 cursor-pointer font-medium mt-2" onClick={() => {setVerificationStep(""); setIsSendingEmail(false);}}>Cancel</p>
            </>
          )}

          {!verificationStep && showSignup && (
            <>
              <input placeholder="Username" className="w-full p-3 mb-3 border border-gray-300 rounded text-black" onChange={(e) => setUsername(e.target.value)} />
              <input type="email" placeholder="Email" className="w-full p-3 mb-3 border border-gray-300 rounded text-black" onChange={(e) => setEmail(e.target.value)} />
              <div className="flex gap-2 mb-3">
                <select value={signupRole} onChange={(e) => setSignupRole(e.target.value)} className="w-1/2 p-3 border border-gray-300 rounded text-black font-medium">
                  <option value="student">👨‍🎓 Student</option><option value="staff">👨‍🏫 Staff</option><option value="hod">🏛️ HOD</option>
                </select>
                <select value={signupDept} onChange={(e) => setSignupDept(e.target.value)} className="w-1/2 p-3 border border-gray-300 rounded text-black font-medium">
                  <option value="CSE">CSE</option><option value="MECH">MECH</option><option value="CIVIL">CIVIL</option><option value="EEE">EEE</option><option value="ECE">ECE</option>
                </select>
              </div>
              <input type="password" placeholder="Password" className="w-full p-3 mb-3 border border-gray-300 rounded text-black" onChange={(e) => setPassword(e.target.value)} />
              <input type="password" placeholder="Confirm Password" className="w-full p-3 mb-3 border border-gray-300 rounded text-black" onChange={(e) => setConfirmPassword(e.target.value)} />
              <div className="text-xs text-gray-500 text-left mb-3 px-1">{passwordErrorMsg}</div>
              <div className="flex gap-2 mb-4">
                <span className="bg-gray-200 p-3 rounded font-mono text-black select-none">{captchaValue}</span>
                <input placeholder="Enter CAPTCHA" className="flex-1 p-3 border border-gray-300 rounded text-black" value={captcha} onChange={(e) => setCaptcha(e.target.value)} />
              </div>
              <button onClick={requestSignupOtp} disabled={isSendingEmail} className={`w-full text-white py-3 rounded mb-2 font-bold transition ${isSendingEmail ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isSendingEmail ? "⏳ Sending Email..." : "Send OTP & Create"}
              </button>
              <p className="text-blue-600 cursor-pointer font-medium mt-2" onClick={() => { setShowSignup(false); resetForms(); }}>Already have an account? Login</p>
            </>
          )}

          {!verificationStep && forgotPassword && (
            <>
              <p className="text-sm text-gray-600 mb-4 text-left">Enter your registered email address to receive an OTP.</p>
              <input type="email" placeholder="Email Address" className="w-full p-3 mb-4 border border-gray-300 rounded text-black" onChange={(e) => setEmail(e.target.value)} />
              <button onClick={requestResetOtp} disabled={isSendingEmail} className={`w-full text-white py-3 rounded mb-2 font-bold transition ${isSendingEmail ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {isSendingEmail ? "⏳ Sending Email..." : "Send OTP"}
              </button>
              <p className="text-blue-600 cursor-pointer font-medium mt-2" onClick={() => { setForgotPassword(false); resetForms(); }}>Back to Login</p>
            </>
          )}

          {!verificationStep && !showSignup && !forgotPassword && (
            <>
              <input placeholder="Username OR Email" className="w-full p-3 mb-3 border border-gray-300 rounded text-black" onChange={(e) => setLoginId(e.target.value)} />
              <input type="password" placeholder="Password" className="w-full p-3 mb-3 border border-gray-300 rounded text-black" onChange={(e) => setPassword(e.target.value)} />
              <div className="flex gap-2 mb-4">
                <span className="bg-gray-200 p-3 rounded font-mono text-black select-none">{captchaValue}</span>
                <input placeholder="Enter CAPTCHA" className="flex-1 p-3 border border-gray-300 rounded text-black" value={captcha} onChange={(e) => setCaptcha(e.target.value)} />
              </div>
              <button onClick={login} className="w-full bg-blue-600 text-white py-3 rounded mb-2 font-bold hover:bg-blue-700 transition">Login</button>
              <div className="flex justify-between text-sm mb-4 mt-2">
                <p className="text-blue-600 cursor-pointer font-medium" onClick={() => { setForgotPassword(true); resetForms(); }}>Forgot Password?</p>
                <p className="text-blue-600 cursor-pointer font-medium" onClick={() => { setShowSignup(true); resetForms(); }}>Create Account</p>
              </div>
              <hr className="mb-4 border-gray-300" />
              <button onClick={handleGoogleLogin} className="w-full bg-red-600 text-white py-3 rounded font-bold hover:bg-red-700 transition">Sign in with Google</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ===== DASHBOARD UI =====
  return (
    <div className="min-h-screen bg-black text-white p-6 relative overflow-hidden">
      
      {/* ===== WHATSAPP-STYLE PUSH NOTIFICATION ===== */}
      <div className={`fixed top-6 right-6 z-[100] transition-all duration-500 ease-in-out transform ${popupMsg ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}`}>
        {popupMsg && (
          <div className="bg-gray-800 border-l-4 border-green-500 text-white p-4 rounded-xl shadow-2xl flex items-start gap-4 w-80 cursor-pointer" onClick={() => setPopupMsg(null)}>
            <div className="bg-green-500/20 rounded-full p-2 flex-shrink-0"><span className="text-2xl">💬</span></div>
            <div className="flex-1 overflow-hidden">
              <div className="flex justify-between items-center mb-1">
                <h4 className="font-bold text-sm text-green-400">TPGIT Notice Board</h4>
                <span className="text-[10px] text-gray-400">Just now</span>
              </div>
              <p className="text-sm font-bold text-white truncate">{popupMsg.title}</p>
              <p className="text-xs text-gray-300 truncate mt-0.5">{popupMsg.desc}</p>
            </div>
            <button className="text-gray-500 hover:text-white transition">✕</button>
          </div>
        )}
      </div>

      {/* Top Header Row */}
      <div className="absolute top-4 right-4 flex items-center gap-6 z-20">
        <div className="relative">
          <button onClick={() => setShowNotifications(!showNotifications)} className="text-2xl relative hover:scale-110 transition mt-1">
            🔔
            {myUnreadNotices.length > 0 && (
              <span className="absolute -top-1 -right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-black animate-pulse">
                {myUnreadNotices.length}
              </span>
            )}
          </button>
          
          {showNotifications && (
            <div className="absolute right-0 mt-3 w-80 bg-gray-900 border border-gray-700 text-white rounded-xl shadow-2xl z-50 overflow-hidden">
               <div className="p-3 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
                 <h3 className="font-bold text-sm">Dept Notifications ({currentUserData.dept})</h3>
                 {myUnreadNotices.length > 0 && <button onClick={markAllAsRead} className="text-xs text-blue-400 hover:text-white font-bold bg-blue-400/10 px-2 py-1 rounded">Mark all read</button>}
               </div>
               <div className="max-h-72 overflow-y-auto">
                 {myUnreadNotices.length === 0 ? (
                   <div className="p-6 text-center text-gray-500 text-sm font-medium">No new notifications.</div>
                 ) : (
                   myUnreadNotices.map(n => (
                     <div key={n.id} onClick={() => markAsRead(n.id)} className="p-4 border-b border-gray-800 hover:bg-gray-800 cursor-pointer transition">
                       <div className="flex justify-between items-start mb-1">
                         <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded">{n.category}</span>
                       </div>
                       <div className="text-sm font-semibold mb-1 leading-tight">{n.title}</div>
                       <div className="text-xs text-gray-500">{n.date}</div>
                     </div>
                   ))
                 )}
               </div>
            </div>
          )}
        </div>

        <span className="text-gray-300 font-medium hidden md:block">
          Welcome, <span className="text-white font-bold">{username}</span> ({role.toUpperCase()})
        </span>
        <button onClick={() => { setLoggedIn(false); setRole(""); setUsername(""); setLoginId(""); setShowNotifications(false); }} className="bg-red-600 px-4 py-2 rounded shadow hover:bg-red-700 transition font-bold">Logout</button>
      </div>
      
      <div className="text-center mb-8 bg-gray-900 py-6 rounded-2xl border border-gray-800 shadow-xl relative overflow-hidden mt-12 md:mt-0">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 relative z-10">
          <img src="/tpgit_logo.png" alt="TPGIT Logo" className="w-20 h-20 bg-white rounded-full p-1" />
          <div>
            <h1 className="text-2xl md:text-4xl font-extrabold text-white tracking-wide">Thanthai Periyar Government Institute of Technology</h1>
            <h2 className="text-xl md:text-2xl font-bold text-blue-400 mt-1">📢 Digital Notice Board</h2>
          </div>
        </div>
        <p className="text-gray-400 font-medium mt-4 z-10 relative">{time.toLocaleString()}</p>
      </div>

      {hasPostAuthority && (
        <div className="bg-gray-900 p-6 rounded-2xl mb-6 shadow-lg border border-gray-800">
          <h2 className="text-xl font-bold mb-4 border-b border-gray-700 pb-2">Institution Control Panel</h2>
          <input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full p-3 mb-3 rounded bg-gray-800 border border-gray-700" />
          <textarea placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full p-3 mb-3 rounded bg-gray-800 border border-gray-700 h-24" />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="p-3 rounded bg-gray-800 border border-gray-700">
              <option>Announcement</option><option>Event</option><option>Exam</option>
            </select>
            <select value={priority} onChange={(e) => setPriority(e.target.value)} className="p-3 rounded bg-gray-800 border border-gray-700">
              <option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option>
            </select>
            <select value={dept} onChange={(e) => setDept(e.target.value)} className="p-3 rounded bg-gray-800 border border-gray-700">
              <option>All</option><option>CSE</option><option>MECH</option><option>CIVIL</option><option>EEE</option><option>ECE</option>
            </select>
          </div>

          {/* NEW: Event Date Input Field */}
          {category === "Event" && (
            <div className="mb-4 animate-fadeIn">
              <label className="block text-sm font-medium mb-1 text-blue-400">Event Countdown Date & Time</label>
              <input type="datetime-local" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full p-3 rounded bg-gray-800 border border-blue-500/50 text-white focus:outline-none focus:border-blue-500 transition" />
            </div>
          )}
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1 text-gray-300">Attach Document/Image</label>
            <input id="file-upload" type="file" onChange={(e) => setAttachment(e.target.files[0])} className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer" />
          </div>

          <button onClick={addNotice} className="w-full py-3 rounded-lg font-bold transition bg-green-600 hover:bg-green-700">
            {editingId ? "✏️ Update Notice" : "➕ Post Notice"}
          </button>
        </div>
      )}

      <div className="flex mb-6 gap-3 flex-wrap bg-gray-900 p-4 rounded-xl border border-gray-800">
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="p-3 rounded bg-gray-800 border border-gray-700">
          <option value="All">All Categories</option><option value="Announcement">Announcement</option><option value="Event">Event</option><option value="Exam">Exam</option>
        </select>
        <input placeholder="🔍 Search Notice by title..." className="flex-1 p-3 rounded bg-gray-800 border border-gray-700" onChange={(e) => setSearch(e.target.value)} />
        <button onClick={() => setShowSavedOnly(!showSavedOnly)} className={`px-4 py-2 rounded font-bold transition border ${showSavedOnly ? 'bg-yellow-500 text-black border-yellow-500' : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white hover:border-gray-500'}`}>
          {showSavedOnly ? "📂 Viewing Saved" : "🔖 Show Saved"}
        </button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="notices" isDropDisabled={!hasPostAuthority}>
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedNotices.length === 0 ? (
                <div className="col-span-full text-center text-gray-500 py-10">{showSavedOnly ? "You haven't saved any notices yet." : "No notices found."}</div>
              ) : (
                sortedNotices.map((n, index) => (
                  <Draggable key={n.id} draggableId={n.id.toString()} index={index} isDragDisabled={!hasPostAuthority}>
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className={`bg-gray-900 p-6 rounded-xl flex flex-col shadow-lg relative transition ${n.pinned ? "border-2 border-yellow-500 shadow-yellow-500/20" : "border border-gray-800"}`}>
                        {hasPostAuthority && (
  <div className="absolute top-2 right-2 flex gap-2 z-10">
    {/* PIN */}
    <button 
      onClick={() => togglePin(n.id)} 
      className={`p-2 rounded-full transition ${n.pinned ? "bg-yellow-500 text-black shadow-lg" : "bg-gray-800 text-gray-400"}`}
    >
      📌
    </button>

    {/* EDIT */}
    <button 
      onClick={() => { 
        setEditingId(n.id); 
        setTitle(n.title); 
        setDesc(n.desc); 
        setCategory(n.category); 
        setPriority(n.priority); 
        setDept(n.dept); 
        setEventDate(n.eventDate || ""); 
      }} 
      className="bg-gray-800 p-2 rounded-full hover:bg-blue-600 transition"
    >
      ✏️
    </button>

    {/* DELETE */}
    <button 
      onClick={() => deleteNotice(n.id)} 
      className="bg-gray-800 p-2 rounded-full hover:bg-red-600 transition text-red-500 hover:text-white"
    >
      🗑️
    </button>
  </div>
)}
                        
                        <div className="flex gap-2 mb-3 mt-6">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${n.priority === 'urgent' ? 'bg-red-600/20 text-red-500' : n.priority === 'important' ? 'bg-yellow-600/20 text-yellow-500' : 'bg-gray-700 text-gray-300'}`}>{n.priority}</span>
                          <span className="bg-blue-600/20 text-blue-400 px-3 py-1 rounded-full text-xs font-bold">{n.dept}</span>
                        </div>

                        {/* EVENT COUNTDOWN DISPLAY SECTION */}
                        {n.category === "Event" && n.eventDate && (
                          <div className="mb-4 p-3 bg-blue-600/10 border border-blue-500/30 rounded-lg text-center shadow-inner">
                            <div className="text-[10px] uppercase tracking-widest text-blue-400 font-extrabold mb-1">Happening In</div>
                            <div className="text-xl font-mono font-bold text-blue-300 animate-pulse tracking-tight">
                              {getCountdown(n.eventDate)}
                            </div>
                          </div>
                        )}

                        <h2 className="text-2xl font-bold mb-2 break-words text-white">{n.title}</h2>
                        <p className="text-sm text-gray-400 mb-4 font-medium">{n.category}</p>
                        <p className="text-gray-300 mb-6 flex-grow whitespace-pre-wrap">{n.desc}</p>
                        
                        {/* Inside your notice card map function */}
{(n.attachment || n.isUploadingFile) && (
  <div className="mt-4 flex gap-2">
    {n.isUploadingFile ? (
      <div className="w-full bg-blue-900/20 py-2 rounded text-center animate-pulse text-xs text-blue-400">
        ⚡ Delivering to CDN...
      </div>
    ) : (
      <>
        <a 
          href={n.attachment?.match(/\.(docx|doc|xlsx|xls|pptx|ppt)$/i) 
            ? `https://docs.google.com/viewer?url=${encodeURIComponent(n.attachment)}&embedded=true` 
            : n.attachment} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded font-bold text-center text-sm shadow-lg"
        >
          👁️ Online View
        </a>
        <a 
          href={n.attachment} 
          download 
          className="bg-gray-800 px-3 py-2 rounded border border-gray-600 text-white"
        >
          ⬇️
        </a>
      </>
    )}
  </div>
)}
                        
                        <div className="mt-auto border-t border-gray-800 pt-4 flex justify-between items-center">
                          <div className="flex gap-2">
                            <button onClick={() => toggleLike(n.id)} className={`flex items-center gap-1 px-3 py-1 rounded-full font-medium transition ${n.likes?.includes(username) ? 'bg-red-500/20 text-red-500' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                              {n.likes?.includes(username) ? "❤️" : "🤍"} {n.likes?.length || 0}
                            </button>
                            <button onClick={() => toggleBookmark(n.id)} className={`flex items-center gap-1 px-3 py-1 rounded-full font-medium transition ${n.bookmarks?.includes(username) ? 'bg-yellow-500/20 text-yellow-500' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
                              {n.bookmarks?.includes(username) ? "🔖 Saved" : "📑 Save"}
                            </button>
                          </div>
                          <span className="text-xs text-gray-500 text-right pl-2">{n.date}</span>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
