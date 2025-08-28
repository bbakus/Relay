import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from '../context/AuthContext'
import { API_CONFIG } from '../utils/apiConfig'
import '../styles/login.css'


export const Login = ({liftUserId}) => {

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [userData, setUserData] = useState({})
    const [requestModal, setRequestModal] = useState(false)
    const [name, setName] = useState('')
    const [requestEmail, setRequestEmail] = useState('')
    const [organization, setOrganization] = useState('')
    const [phone, setPhone] = useState('')
    const [loginError, setLoginError] = useState('')
    const [requestError, setRequestError] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [confirmationModal, setConfirmationModal] = useState(false)
    const {setUser} = useAuth()

    const navigate = useNavigate()

    function handleEmail(e){
        setEmail(e.target.value)
        if (loginError) setLoginError('')
    }

    function handlePassword(e){
        setPassword(e.target.value)
        if (loginError) setLoginError('')
    }

    function handleLogin(e){
        e.preventDefault()
        setLoginError('')
        setIsLoading(true)

        // Basic validation
        if (!email.trim()) {
            setLoginError('Email is required')
            setIsLoading(false)
            return
        }
        if (!password.trim()) {
            setLoginError('Password is required')
            setIsLoading(false)
            return
        }

        fetch(`${API_CONFIG.baseUrl}/api/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        })
        .then(res => res.json())
        .then(data => {
            setIsLoading(false)
            if (data.user && data.user.id) {
                setUser(data.user)
                navigate(`/${data.user.id}/dashboard`)
            } else {
                setLoginError(data.error || 'Invalid email or password')
            }
        })
        .catch(err => {
            setIsLoading(false)
            console.error('Login failed', err)
            setLoginError('Login failed. Please check your connection and try again.')
        })
    }


    function handleAccessRequest(){
        setRequestModal(true)
        setRequestError('')
    }

    const handleRequestSubmit = async (e) => {
        e.preventDefault()
        setRequestError('')
        
        // Comprehensive validation
        if (!name.trim()) {
            setRequestError('Name is required')
            return
        }
        if (!requestEmail.trim()) {
            setRequestError('Email is required')
            return
        }
        if (!organization.trim()) {
            setRequestError('Organization is required')
            return
        }
        if (!phone.trim()) {
            setRequestError('Phone number is required')
            return
        }
        
        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(requestEmail)) {
            setRequestError('Please enter a valid email address')
            return
        }
        
        // Phone format validation (basic)
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
        const cleanPhone = phone.replace(/[\s\-\(\)]/g, '')
        if (!phoneRegex.test(cleanPhone) || cleanPhone.length < 10) {
            setRequestError('Please enter a valid phone number (at least 10 digits)')
            return
        }
        
        try {
            setIsLoading(true)
            const response = await fetch(`${API_CONFIG.baseUrl}/api/access-requests`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: name.trim(),
                    email: requestEmail.trim(),
                    organization: organization.trim(),
                    phone: phone.trim(),
                    created_at: new Date().toISOString()
                })
            })
            
            const data = await response.json()
            setIsLoading(false)
            
            if (response.ok) {
                // Close request modal and show confirmation modal
                setRequestModal(false)
                setConfirmationModal(true)
                // Reset form
                setName('')
                setRequestEmail('')
                setOrganization('')
                setPhone('')
                setRequestError('')
            } else {
                setRequestError(data.error || 'Failed to submit access request')
            }
        } catch (error) {
            setIsLoading(false)
            console.error('Error submitting access request:', error)
            setRequestError('Failed to submit access request. Please check your connection and try again.')
        }
    }

    return(
        <div>
            <div className='login-container'>
                <img src="/images/logo/logo5.png" alt='Logo'/>
                {/* <h1>DH RELAY</h1> */}
                <div className='login-form-container'>
                    <form onSubmit={handleLogin}>
                        <p>EMAIL</p>
                        <input type="email" onChange={e => handleEmail(e)} value={email} placeholder="me@example.com" required/>
                        <p>PASSWORD</p>
                        <input type="password" onChange={e => handlePassword(e)} value={password} placeholder="password123" required/>
                        {loginError && <div className='error-message'>{loginError}</div>}
                        <button type="submit" className='login-button' disabled={isLoading}>
                            {isLoading ? 'LOGGING IN...' : 'LOGIN'}
                        </button>
                    </form>
                    <button onClick={handleAccessRequest} className='request-access-button'>REQUEST ACCESS</button>
                </div>
            </div>
            {requestModal && (
                <div className='request-modal-container'>
                    <div className='request-modal'>
                        <div className='request-modal-header'>
                            
                            <button className='request-modal-close' onClick={() => setRequestModal(false)} aria-label='Close'>&times;</button>
                        </div>
                        <form onSubmit={handleRequestSubmit}>
                            <p>NAME</p>
                            <input onChange={e => {setName(e.target.value); if (requestError) setRequestError('')}} value={name} type='text' placeholder="John Smith" required/>
                            <p>EMAIL</p>
                            <input onChange={(e) => {setRequestEmail(e.target.value); if (requestError) setRequestError('')}} value={requestEmail} type='email' placeholder='me@example.com' required/>
                            <p>ORGANIZATION</p>
                            <input onChange={e => {setOrganization(e.target.value); if (requestError) setRequestError('')}} value={organization} type='text' placeholder='The Studio LLC' required/>
                            <p>PHONE</p>
                            <input onChange={e => {setPhone(e.target.value); if (requestError) setRequestError('')}} value={phone} type='tel' placeholder='(555) 123-4567' required/>
                            {requestError && <div className='error-message'>{requestError}</div>}
                            <div className='request-modal-actions'>
                                <button type='button' className='request-cancel-button' onClick={() => setRequestModal(false)}>CANCEL</button>
                                <button type='submit' className='submit-request-button' disabled={isLoading}>
                                    {isLoading ? 'SUBMITTING...' : 'SUBMIT'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {confirmationModal && (
                <div className='request-modal-container'>
                    <div className='request-modal confirmation-modal'>
                        <div className='request-modal-header'>
                            <button className='request-modal-close' onClick={() => setConfirmationModal(false)} aria-label='Close'>&times;</button>
                        </div>
                        <div className='confirmation-content'>
                            <div className='confirmation-icon'>✓</div>
                            <h2>Request Submitted Successfully!</h2>
                            <p>You will receive an email once the Admin approves your request.</p>
                            <button 
                                className='confirmation-button' 
                                onClick={() => setConfirmationModal(false)}
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}