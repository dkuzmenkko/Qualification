const DefaultAvatar = ({ size = 40, name = 'User' }) => {
  const initials = name.charAt(0).toUpperCase();
  
  return (
    <div className='avatar'>
      {initials}
    </div>
  );
};

export default DefaultAvatar;